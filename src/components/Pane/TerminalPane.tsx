import { useState, useCallback, useRef, useEffect } from 'react';
import { useTabStore } from '@/stores/useTabStore';
import { MessageBubble } from '@/components/Chat/MessageBubble';
import type { ChatMessage } from '@/types/chat';
import styles from './TerminalPane.module.css';

interface TerminalPaneProps {
  tabId: string;
  paneId: string;
  isActive: boolean;
}

// Pane-local chat state (each pane has its own conversation)
const paneChats = new Map<string, ChatMessage[]>();
const paneGenerating = new Map<string, boolean>();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function TerminalPane({ tabId, paneId, isActive }: TerminalPaneProps) {
  const tab = useTabStore((s) => s.tabs.get(tabId));
  const pane = tab?.panes.get(paneId);
  const setActivePane = useTabStore((s) => s.setActivePane);
  const splitPane = useTabStore((s) => s.splitPane);
  const closePane = useTabStore((s) => s.closePane);

  const [text, setText] = useState('');
  const messages = paneChats.get(paneId) || [];
  const isGenerating = paneGenerating.get(paneId) || false;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize pane chat if not exists
  useEffect(() => {
    if (!paneChats.has(paneId)) {
      paneChats.set(paneId, []);
    }
  }, [paneId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleFocus = useCallback(() => {
    if (!isActive) setActivePane(tabId, paneId);
  }, [isActive, tabId, paneId, setActivePane]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    const current = paneChats.get(paneId) || [];
    paneChats.set(paneId, [...current, userMsg]);
    paneGenerating.set(paneId, true);
    setText('');

    // Mock response (will be replaced with real CLI bridge)
    setTimeout(() => {
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `[${pane?.title || 'Terminal'}] 收到: ${trimmed}\n\n这是一个独立面板的会话。未来将连接真实的 Claude CLI 进程。`,
        timestamp: Date.now(),
      };
      const msgs = paneChats.get(paneId) || [];
      paneChats.set(paneId, [...msgs, assistantMsg]);
      paneGenerating.set(paneId, false);
      // Force re-render
      useTabStore.setState((s) => ({ tabs: new Map(s.tabs) }));
    }, 600);
  }, [text, pane?.title, paneId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

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

        {/* Compact input */}
        <div className={styles.paneInput}>
          <div className={styles.paneInputWrapper}>
            <button className={styles.paneAttachBtn} title="附件">
              <span className="material-symbols-outlined">attach_file</span>
            </button>
            <input
              className={styles.paneInputField}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="给 Claude 发送消息或询问代码问题..."
              spellCheck={false}
            />
            <button
              className={`${styles.paneSendBtn} ${canSend ? styles.paneSendBtnActive : ''}`}
              onClick={handleSend}
              disabled={!canSend}
            >
              <span className="material-symbols-outlined">arrow_upward</span>
            </button>
          </div>
          {/* Footer — shortcut hints */}
          <div className={styles.paneInputFooter}>
            <div className={styles.paneFooterLeft}>
              <span className={styles.paneFooterHint}>
                <span className="material-symbols-outlined">keyboard_command_key</span> L 搜索代码
              </span>
              <span className={styles.paneFooterHint}>
                <span className="material-symbols-outlined">keyboard_command_key</span> K 快速修复
              </span>
            </div>
            <span className={styles.paneFooterHint}>4096 tokens left</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export { TerminalPane };
