import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTabStore } from '@/stores/useTabStore';
import { useChatStore } from '@/stores/useChatStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { MessageBubble } from '@/components/Chat/MessageBubble';
import { PermissionBar } from '@/components/Chat/PermissionBar';
import { claudeApi, isElectron } from '@/lib/claude-api';
import { getPermissionInfo } from '@/lib/tool-utils';
import { InputBar } from './InputBar';
import styles from './TerminalPane.module.css';

// ── Props ──

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
  const paneProjectPath = useTabStore((s) => s.projectPaths.get(paneId)) ?? activeProject?.path ?? '';

  const paneState = useChatStore((s) => s.panes.get(paneId));
  const messages = paneState?.messages ?? [];
  const isGenerating = paneState?.isGenerating ?? false;
  const tokenUsage = paneState?.tokenUsage ?? { input: 0, output: 0 };
  const grantPermission = useChatStore((s) => s.grantPermission);
  const denyPermission = useChatStore((s) => s.denyPermission);
  const pendingPermission = useChatStore((s) => s.pendingPermission);
  const setPermissionMode = useChatStore((s) => s.setPermissionMode);

  const [claudeConfigModel, setClaudeConfigModel] = useState('');
  const currentModel = paneState?.currentModel || claudeConfigModel || '';

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Fetch model from Claude CLI config on mount
  useEffect(() => {
    if (!isElectron()) return;
    claudeApi.getClaudeConfig().then((config) => {
      if (config?.model) setClaudeConfigModel(config.model);
    }).catch(() => {});
  }, []);

  // ── Initialize / cleanup pane ──

  useEffect(() => {
    if (paneProjectPath) {
      useChatStore.getState().initPane(paneId, paneProjectPath);
    }
  }, [paneId, paneProjectPath]);

  useEffect(() => {
    return () => {
      useChatStore.getState().clearPane(paneId);
    };
  }, [paneId]);

  // ── Scroll to bottom ──

  const lastMsg = messages[messages.length - 1];
  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    const isNewMessage = messages.length > prevMsgCountRef.current;
    prevMsgCountRef.current = messages.length;
    const isStreaming = lastMsg?.isStreaming;
    const scrollContainer = messagesContainerRef.current;
    if (scrollContainer) {
      const nearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 80;
      if (isNewMessage && !isStreaming) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else if (isStreaming && nearBottom) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages.length, lastMsg?.content?.length, lastMsg?.isStreaming]);

  // ── Pane actions ──

  const handleFocus = useCallback(() => {
    if (!isActive) setActivePane(tabId, paneId);
  }, [isActive, tabId, paneId, setActivePane]);

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
  const paneRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setIsNarrow(entries[0].contentRect.width < 500);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const shortProjectName = paneProjectPath ? paneProjectPath.split('/').filter(Boolean).pop() || '' : '';

  // 权限信息
  const permissionInfo = useMemo(() => {
    if (!pendingPermission) return null;
    return getPermissionInfo(pendingPermission.name, pendingPermission.input);
  }, [pendingPermission]);

  return (
    <div
      ref={paneRef}
      className={`${styles.terminalPane} ${isActive ? styles.terminalPaneActive : ''} ${isNarrow ? styles.terminalPaneNarrow : ''}`}
      onClick={handleFocus}
    >
      {/* Pane header — only show when split */}
      {!isSinglePane && <div className={styles.paneHeader}>
        <div className={styles.paneHeaderLeft}>
          <span className={`${styles.paneStatus} ${styles[statusClass]}`} />
          <span className={styles.paneTitle}>{shortProjectName || pane?.title || 'Terminal'}</span>
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
        <div ref={messagesContainerRef} className={styles.paneMessages}>
          <div className={styles.paneMessagesInner}>
            {messages.length === 0 && (
              <div className={styles.paneEmpty}>
                Claude Code 终端 — 输入消息开始
              </div>
            )}
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                paneId={paneId}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Permission bar — floats above input when a tool needs approval */}
        {permissionInfo && (
          <PermissionBar
            toolName={permissionInfo.toolName}
            toolIcon={permissionInfo.toolIcon}
            target={permissionInfo.target}
            detail={pendingPermission!.input.content as string | undefined}
            isDangerous={permissionInfo.isDangerous}
            onAllow={() => grantPermission()}
            onDeny={() => denyPermission()}
            onAllowAlways={() => { grantPermission(); setPermissionMode('bypass'); }}
          />
        )}

        {/* Input — 拆分为独立组件，避免 keystroke 触发全组件 re-render */}
        <InputBar
          paneId={paneId}
          isStreaming={isGenerating}
          currentModel={currentModel}
          claudeConfigModel={claudeConfigModel}
          tokenUsage={tokenUsage}
          isActive={isActive}
          isNarrow={isNarrow}
        />
      </div>
    </div>
  );
}

export { TerminalPane };
