import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useChatStore } from '@/stores/useChatStore';
import type { FileNode } from '@/types/chat';
import styles from './InputArea.module.css';

/** Flatten file tree into a searchable list */
function flattenTree(nodes: FileNode[], basePath = ''): Array<{ name: string; path: string; type: string }> {
  const result: Array<{ name: string; path: string; type: string }> = [];
  for (const node of nodes) {
    const displayPath = basePath ? `${basePath}/${node.name}` : node.name;
    if (node.type === 'file') {
      result.push({ name: node.name, path: displayPath, type: 'file' });
    }
    if (node.type === 'directory' && node.children) {
      result.push(...flattenTree(node.children, displayPath));
    }
  }
  return result;
}

const SLASH_COMMANDS = [
  { name: '/clear', description: '清除对话历史', icon: 'delete_sweep' },
  { name: '/compact', description: '压缩上下文', icon: 'compress' },
  { name: '/help', description: '显示帮助信息', icon: 'help' },
];

function InputArea() {
  const [text, setText] = useState('');
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showSlash, setShowSlash] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopGeneration = useChatStore((s) => s.stopGeneration);
  const clearChat = useChatStore((s) => s.clearChat);
  const fileTree = useChatStore((s) => s.fileTree);

  const flatFiles = useMemo(() => flattenTree(fileTree), [fileTree]);

  const filteredFiles = useMemo(() => {
    if (!mentionQuery) return flatFiles.slice(0, 8);
    const q = mentionQuery.toLowerCase();
    return flatFiles
      .filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
      .slice(0, 8);
  }, [flatFiles, mentionQuery]);

  const filteredCommands = useMemo(() => {
    if (!slashQuery) return SLASH_COMMANDS;
    const q = slashQuery.toLowerCase();
    return SLASH_COMMANDS.filter(c => c.name.toLowerCase().includes(q) || c.description.includes(q));
  }, [slashQuery]);

  const canSend = text.trim().length > 0 && !isGenerating;

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 56), 200)}px`;
  }, [text]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showMention && !showSlash) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowMention(false);
        setShowSlash(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMention, showSlash]);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    sendMessage(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '56px';
    }
  }, [canSend, text, sendMessage]);

  const executeCommand = useCallback((cmd: string) => {
    if (cmd === '/clear') {
      clearChat();
      setText('');
    } else {
      // Send as a regular message
      sendMessage(cmd);
      setText('');
    }
    setShowSlash(false);
  }, [clearChat, sendMessage]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);

    // Detect @ mention trigger
    const atMatch = textBeforeCursor.match(/@(\S*)$/);
    if (atMatch) {
      setShowMention(true);
      setShowSlash(false);
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
      return;
    }

    // Detect / slash command trigger (only at start of line or after space)
    const slashMatch = textBeforeCursor.match(/\/(\S*)$/);
    if (slashMatch && (slashMatch.index === 0 || textBeforeCursor[(slashMatch.index ?? 0) - 1] === ' ' || textBeforeCursor[(slashMatch.index ?? 0) - 1] === '\n')) {
      setShowSlash(true);
      setShowMention(false);
      setSlashQuery(slashMatch[1]);
      setSlashIndex(0);
      return;
    }

    setShowMention(false);
    setShowSlash(false);
  }, []);

  const handleMentionSelect = useCallback((file: { path: string }) => {
    const el = textareaRef.current;
    if (!el) return;

    const cursorPos = el.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@\S*$/);

    if (atMatch) {
      const before = text.slice(0, atMatch.index) + `@${file.path} `;
      const after = text.slice(cursorPos);
      setText(before + after);

      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = before.length;
        el.focus();
      });
    }

    setShowMention(false);
  }, [text]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Handle @ mention dropdown
      if (showMention && filteredFiles.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setMentionIndex((i) => (i + 1) % filteredFiles.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setMentionIndex((i) => (i - 1 + filteredFiles.length) % filteredFiles.length);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          handleMentionSelect(filteredFiles[mentionIndex]);
          return;
        }
        if (e.key === 'Escape') {
          setShowMention(false);
          return;
        }
      }

      // Handle / slash command dropdown
      if (showSlash && filteredCommands.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSlashIndex((i) => (i + 1) % filteredCommands.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSlashIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          executeCommand(filteredCommands[slashIndex].name);
          return;
        }
        if (e.key === 'Escape') {
          setShowSlash(false);
          return;
        }
      }

      // Enter sends, Shift+Enter inserts newline
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [showMention, filteredFiles, mentionIndex, handleMentionSelect, showSlash, filteredCommands, slashIndex, executeCommand, handleSend],
  );

  const showDropdown = showMention && filteredFiles.length > 0;
  const showSlashDropdown = showSlash && filteredCommands.length > 0;

  return (
    <div className={styles.inputArea}>
      <div className={styles.inputWrapper}>
        <textarea
          ref={textareaRef}
          className={styles.inputTextarea}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="输入消息… @ 引用文件 / 斜杠命令"
          spellCheck={false}
          rows={1}
        />

        {/* Dropdown: @ mentions or / commands */}
        {showDropdown && (
          <div className={styles.dropdown} ref={dropdownRef}>
            {filteredFiles.map((file, i) => (
              <div
                key={file.path}
                className={`${styles.dropdownItem} ${i === mentionIndex ? styles.dropdownItemActive : ''}`}
                onClick={() => handleMentionSelect(file)}
                onMouseEnter={() => setMentionIndex(i)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                  description
                </span>
                <span className={styles.dropdownPath}>{file.path}</span>
              </div>
            ))}
          </div>
        )}

        {showSlashDropdown && (
          <div className={styles.dropdown} ref={dropdownRef}>
            {filteredCommands.map((cmd, i) => (
              <div
                key={cmd.name}
                className={`${styles.dropdownItem} ${i === slashIndex ? styles.dropdownItemActive : ''}`}
                onClick={() => executeCommand(cmd.name)}
                onMouseEnter={() => setSlashIndex(i)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                  {cmd.icon}
                </span>
                <div className={styles.dropdownCommand}>
                  <span className={styles.dropdownCmdName}>{cmd.name}</span>
                  <span className={styles.dropdownCmdDesc}>{cmd.description}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.inputFooter}>
          <div className={styles.inputFooterLeft}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)', cursor: 'pointer' }}>attach_file</span>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)', cursor: 'pointer' }}>image</span>
          </div>
          <div className={styles.inputFooterRight}>
            {isGenerating ? (
              <button className={styles.stopBtn} onClick={stopGeneration}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>stop_circle</span>
                停止
              </button>
            ) : (
              <button
                className={`${styles.sendBtn} ${canSend ? styles.sendBtnActive : ''}`}
                onClick={handleSend}
                disabled={!canSend}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_upward</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { InputArea };
