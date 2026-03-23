import { useState, useCallback, useRef, useEffect } from 'react';
import { useTabStore } from '@/stores/useTabStore';
import { useChatStore } from '@/stores/useChatStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { MessageBubble } from '@/components/Chat/MessageBubble';
import styles from './TerminalPane.module.css';

interface TerminalPaneProps {
  tabId: string;
  paneId: string;
  isActive: boolean;
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

  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleFocus = useCallback(() => {
    if (!isActive) setActivePane(tabId, paneId);
  }, [isActive, tabId, paneId, setActivePane]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = '44px';
    useChatStore.getState().sendMessage(paneId, trimmed);
  }, [text, paneId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

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
          <div className={styles.paneInputWrapper}>
            <button className={styles.paneAttachBtn} title="附件">
              <span className="material-symbols-outlined">attach_file</span>
            </button>
            <textarea
              ref={textareaRef}
              className={styles.paneInputField}
              value={text}
              onChange={(e) => setText(e.target.value)}
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
