import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useChatStore } from '@/stores/useChatStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
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
  const { settings } = useSettingsStore();

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
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 100), 200)}px`;
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
      textareaRef.current.style.height = '100px';
    }
  }, [canSend, text, sendMessage]);

  const executeCommand = useCallback((cmd: string) => {
    if (cmd === '/clear') {
      clearChat();
      setText('');
    } else {
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

    const atMatch = textBeforeCursor.match(/@(\S*)$/);
    if (atMatch) {
      setShowMention(true);
      setShowSlash(false);
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
      return;
    }

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
      if (showMention && filteredFiles.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex((i) => (i + 1) % filteredFiles.length); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex((i) => (i - 1 + filteredFiles.length) % filteredFiles.length); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); handleMentionSelect(filteredFiles[mentionIndex]); return; }
        if (e.key === 'Escape') { setShowMention(false); return; }
      }

      if (showSlash && filteredCommands.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex((i) => (i + 1) % filteredCommands.length); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); executeCommand(filteredCommands[slashIndex].name); return; }
        if (e.key === 'Escape') { setShowSlash(false); return; }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [showMention, filteredFiles, mentionIndex, handleMentionSelect, showSlash, filteredCommands, slashIndex, executeCommand, handleSend],
  );

  const showDropdown = showMention && filteredFiles.length > 0;
  const showSlashDropdown = showSlash && filteredCommands.length > 0;

  const displayModel = useChatStore((s) => s.currentModel) || settings.defaultModel || 'claude-sonnet-4-6';
  const modelLabel = displayModel.replace('claude-', '').replace(/-\d{8}$/, '');

  return (
    <div className={styles.inputArea}>
      <div className={styles.inputWrapper} ref={dropdownRef}>
        <textarea
          ref={textareaRef}
          className={styles.inputTextarea}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="输入指令，例如 '/patch fix-issue'..."
          spellCheck={false}
          rows={1}
        />

        {/* Dropdowns */}
        {showDropdown && (
          <div className={styles.dropdown}>
            {filteredFiles.map((file, i) => (
              <div
                key={file.path}
                className={`${styles.dropdownItem} ${i === mentionIndex ? styles.dropdownItemActive : ''}`}
                onClick={() => handleMentionSelect(file)}
                onMouseEnter={() => setMentionIndex(i)}
              >
                <span className="material-symbols-outlined">description</span>
                <span className={styles.dropdownPath}>{file.path}</span>
              </div>
            ))}
          </div>
        )}

        {showSlashDropdown && (
          <div className={styles.dropdown}>
            {filteredCommands.map((cmd, i) => (
              <div
                key={cmd.name}
                className={`${styles.dropdownItem} ${i === slashIndex ? styles.dropdownItemActive : ''}`}
                onClick={() => executeCommand(cmd.name)}
                onMouseEnter={() => setSlashIndex(i)}
              >
                <span className="material-symbols-outlined">{cmd.icon}</span>
                <div className={styles.dropdownCommand}>
                  <span className={styles.dropdownCmdName}>{cmd.name}</span>
                  <span className={styles.dropdownCmdDesc}>{cmd.description}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons inside textarea */}
        <div className={styles.inputActions}>
          <button className={styles.attachBtn} title="附件">
            <span className="material-symbols-outlined">attach_file</span>
          </button>
          {isGenerating ? (
            <button className={styles.stopBtn} onClick={stopGeneration} title="停止生成">
              <span className="material-symbols-outlined">stop_circle</span>
            </button>
          ) : (
            <button
              className={`${styles.sendBtn} ${canSend ? styles.sendBtnActive : ''}`}
              onClick={handleSend}
              disabled={!canSend}
              title="发送 (⌘+Enter)"
            >
              <span className="material-symbols-outlined">arrow_upward</span>
            </button>
          )}
        </div>
      </div>

      {/* Footer hints */}
      <div className={styles.inputFooter}>
        <div className={styles.inputFooterLeft}>
          <span className={styles.modelIndicator}>
            <span className={styles.modelDot} />
            {modelLabel}
          </span>
          <span className={styles.encoding}>UTF-8</span>
        </div>
        <span className={styles.shortcutHint}>{'\u2318'}+Enter 发送</span>
      </div>
    </div>
  );
}

export { InputArea };
