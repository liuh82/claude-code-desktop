import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTabStore } from '@/stores/useTabStore';
import { useChatStore } from '@/stores/useChatStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { MessageBubble } from '@/components/Chat/MessageBubble';
import type { FileNode } from '@/types/chat';
import styles from './TerminalPane.module.css';

interface TerminalPaneProps {
  tabId: string;
  paneId: string;
  isActive: boolean;
}

// Flatten file tree for search
function flattenTree(nodes: FileNode[], prefix = ''): FileNode[] {
  const result: FileNode[] = [];
  for (const node of nodes) {
    const path = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === 'file') {
      result.push({ ...node, path });
    }
    if (node.children) {
      result.push(...flattenTree(node.children, path));
    }
  }
  return result;
}

function TerminalPane({ tabId, paneId, isActive }: TerminalPaneProps) {
  const tab = useTabStore((s) => s.tabs.get(tabId));
  const pane = tab?.panes.get(paneId);
  const setActivePane = useTabStore((s) => s.setActivePane);
  const splitPane = useTabStore((s) => s.splitPane);
  const closePane = useTabStore((s) => s.closePane);
  const activeProject = useProjectStore((s) => s.activeProject);
  const projectPath = activeProject?.path ?? '';

  // Chat state per pane from store
  const paneState = useChatStore((s) => s.panes.get(paneId));
  const messages = paneState?.messages ?? [];
  const isGenerating = paneState?.isGenerating ?? false;
  const tokenUsage = paneState?.tokenUsage ?? { input: 0, output: 0 };
  const fileTree = useChatStore((s) => s.fileTree);
  console.log('[CCDesk] fileTree top-level:', fileTree.length, 'projectPath:', projectPath);

  const [text, setText] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showMention, setShowMention] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  // Flatten file tree for @ mentions
  const flatFiles = useMemo(() => flattenTree(fileTree), [fileTree]);
  console.log('[CCDesk] flatFiles total:', flatFiles.length);

  const filteredFiles = useMemo(() => {
    if (!mentionQuery) return flatFiles.slice(0, 20);
    const q = mentionQuery.toLowerCase();
    return flatFiles
      .filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
      .slice(0, 20);
  }, [flatFiles, mentionQuery]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), 200)}px`;
  }, [text]);

  // Initialize pane session on mount
  useEffect(() => {
    if (projectPath) {
      useChatStore.getState().initPane(paneId, projectPath);
    }
  }, [paneId, projectPath]);

  // Clear pane session on unmount
  useEffect(() => {
    return () => {
      useChatStore.getState().clearPane(paneId);
    };
  }, [paneId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Close mention dropdown on outside click
  useEffect(() => {
    if (!showMention) return;
    const handler = (e: MouseEvent) => {
      if (inputWrapperRef.current && !inputWrapperRef.current.contains(e.target as Node)) {
        setShowMention(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMention]);

  const handleFocus = useCallback(() => {
    if (!isActive) setActivePane(tabId, paneId);
  }, [isActive, tabId, paneId, setActivePane]);

  const handleMentionSelect = useCallback((file: FileNode) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@\S*$/);
    if (!atMatch) return;

    const before = text.slice(0, atMatch.index) + `@${file.path} `;
    const after = text.slice(cursorPos);
    const newPos = before.length;
    setText(before + after);
    setShowMention(false);
    setMentionQuery('');
    setMentionIndex(0);
    setTimeout(() => {
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
    }, 0);
  }, [text]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    setShowMention(false);
    if (textareaRef.current) textareaRef.current.style.height = '44px';
    useChatStore.getState().sendMessage(paneId, trimmed);
  }, [text, paneId]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);

    // Detect @ mentions
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newText.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\S*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setShowMention(true);
      setMentionIndex(0);
      console.log('[CCDesk] @ mention detected:', atMatch[1], 'files:', flatFiles.length);
    } else {
      setShowMention(false);
      setMentionQuery('');
    }
  }, [flatFiles]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Handle mention dropdown navigation
    if (showMention && filteredFiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => (i + 1) % filteredFiles.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => (i - 1 + filteredFiles.length) % filteredFiles.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleMentionSelect(filteredFiles[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMention(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [showMention, filteredFiles, mentionIndex, handleMentionSelect, handleSend]);

  const handleStop = useCallback(() => {
    useChatStore.getState().stopGeneration(paneId);
  }, [paneId]);

  const handleSplitHorizontal = useCallback(() => {
    splitPane(tabId, paneId, 'horizontal');
  }, [tabId, paneId, splitPane]);

  const handleSplitVertical = useCallback(() => {
    splitPane(tabId, paneId, 'vertical');
  }, [tabId, paneId, splitPane]);

  const handleClose = useCallback(() => {
    closePane(tabId, paneId);
  }, [tabId, paneId, closePane]);

  const status = pane?.status || 'idle';
  const statusClass = `paneStatus${status.charAt(0).toUpperCase()}${status.slice(1)}`;
  const isSinglePane = (tab?.panes.size ?? 0) <= 1;
  const canSend = text.trim().length > 0 && !isGenerating;

  // Token display
  const tokensLeft = 200000 - (tokenUsage.input + tokenUsage.output);
  const tokensDisplay = tokensLeft > 1000
    ? `${Math.round(tokensLeft / 1000)}K tokens left`
    : `${tokensLeft} tokens left`;

  return (
    <div
      className={`${styles.terminalPane} ${isActive ? styles.terminalPaneActive : ''}`}
      onClick={handleFocus}
    >
      {/* Pane header — only show when split */}
      {!isSinglePane && <div className={styles.paneHeader}>
        <div className={styles.paneHeaderLeft}>
          <span className={`${styles.paneStatus} ${styles[statusClass]}`} />
          <span className={styles.paneTitle}>{pane?.title || 'Terminal'}</span>
        </div>
        <div className={styles.paneHeaderRight}>
          <button
            className={`${styles.paneAction} ${styles.paneActionSplit}`}
            onClick={handleSplitHorizontal}
            title="水平分割 (⌘D)"
          >
            <span className="material-symbols-outlined">vertical_split</span>
          </button>
          <button
            className={`${styles.paneAction} ${styles.paneActionSplit}`}
            onClick={handleSplitVertical}
            title="垂直分割 (⌘⇧D)"
          >
            <span className="material-symbols-outlined">horizontal_split</span>
          </button>
          <button
            className={`${styles.paneAction} ${styles.paneActionClose}`}
            onClick={handleClose}
            title="关闭面板 (⌘W)"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>}

      {/* Messages */}
      <div className={styles.paneBody}>
        <div className={styles.paneMessages}>
          <div className={styles.paneMessagesInner}>
            {messages.length === 0 ? (
              <div className={styles.paneEmpty}>
                Claude Code 终端 — 输入消息开始
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className={styles.paneInput}>
          <div className={styles.paneInputWrapper} ref={inputWrapperRef}>
            <button className={styles.paneAttachBtn} title="附件">
              <span className="material-symbols-outlined">attach_file</span>
            </button>
            <textarea
              ref={textareaRef}
              className={styles.paneInputField}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="给 Claude 发送消息或询问代码问题..."
              spellCheck={false}
              rows={1}
            />
            {isGenerating ? (
              <button
                className={styles.paneSendBtn}
                onClick={handleStop}
                title="停止生成"
              >
                <span className="material-symbols-outlined">stop_circle</span>
              </button>
            ) : (
              <button
                className={`${styles.paneSendBtn} ${canSend ? styles.paneSendBtnActive : ''}`}
                onClick={handleSend}
                disabled={!canSend}
                title="发送 (⌘Enter)"
              >
                <span className="material-symbols-outlined">arrow_upward</span>
              </button>
            )}

            {/* @ Mention dropdown */}
            {showMention && filteredFiles.length > 0 && (
              <div className={styles.mentionDropdown}>
                {filteredFiles.map((file, idx) => (
                  <div
                    key={file.path}
                    className={`${styles.mentionItem} ${idx === mentionIndex ? styles.mentionItemActive : ''}`}
                    onClick={() => handleMentionSelect(file)}
                    onMouseEnter={() => setMentionIndex(idx)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14, marginRight: 6 }}>description</span>
                    <span className={styles.mentionName}>{file.name}</span>
                    <span className={styles.mentionPath}>{file.path}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Footer */}
          <div className={styles.paneInputFooter}>
            <div className={styles.paneFooterLeft}>
              <span className={styles.paneFooterHint}>
                <span className="material-symbols-outlined">keyboard_command_key</span> L 搜索代码
              </span>
              <span className={styles.paneFooterHint}>
                <span className="material-symbols-outlined">keyboard_command_key</span> K 快速修复
              </span>
            </div>
            <span className={styles.paneFooterHint}>{tokensDisplay}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export { TerminalPane };
