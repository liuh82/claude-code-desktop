import { useCallback, useMemo, useState } from 'react';
import { useChatStore } from '@/stores/useChatStore';
import { useTabStore } from '@/stores/useTabStore';
import { FileTree } from './FileTree';
import { DiffView } from './DiffView';
import { SafeRender } from './SafeRender';
import type { FileNode } from '@/types/chat';
import styles from './ToolPanel.module.css';

interface ToolPanelProps {
  onClose: () => void;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function ToolPanel({ onClose, style }: ToolPanelProps & { style?: React.CSSProperties }) {
  const fileTree = useChatStore((s) => s.fileTree);
  const diffFiles = useChatStore((s) => s.diffFiles);
  const activeTabId = useTabStore((s) => s.activeTabId);

  const pane = useChatStore((s) => {
    if (!activeTabId) return null;
    const tab = useTabStore.getState().tabs.get(activeTabId);
    if (!tab) return null;
    return s.panes.get(tab.activePaneId) ?? null;
  });

  const activeDiffFile = diffFiles.length > 0 ? diffFiles[0].filePath : '';
  const [activeTab, setActiveTab] = useState<'files' | 'diff'>('files');
  const [fileTreeCollapsed, setFileTreeCollapsed] = useState(false);

  const handleFileClick = useCallback((node: FileNode) => {
    useChatStore.getState().triggerFileMention(node.path);
    // Phase 3: open file in editor
  }, []);

  // CC session data
  const inputTokens = pane?.tokenUsage.input ?? 0;
  const outputTokens = pane?.tokenUsage.output ?? 0;

  const { toolCallCount, userMsgCount, assistantMsgCount } = useMemo(() => {
    const msgs = pane?.messages ?? [];
    let toolCalls = 0, userMsgs = 0, assistantMsgs = 0;
    for (const msg of msgs) {
      if (msg.role === 'user') userMsgs++;
      else if (msg.role === 'assistant') {
        assistantMsgs++;
        if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'tool_use') toolCalls++;
          }
        }
      }
    }
    return { toolCallCount: toolCalls, userMsgCount: userMsgs, assistantMsgCount: assistantMsgs };
  }, [pane?.messages]);

  const estimatedCost = useMemo(() => {
    return (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;
  }, [inputTokens, outputTokens]);

  const codeChanges = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const f of diffFiles) {
      for (const hunk of f.hunks) {
        for (const line of hunk.lines) {
          if (line.type === 'add') added++;
          else if (line.type === 'delete') removed++;
        }
      }
    }
    return { added, removed };
  }, [diffFiles]);

  return (
    <aside className={styles.toolPanel} style={style}>
      <div className={styles.toolPanelHeader}>
        <span className="material-symbols-outlined" style={{fontSize: 18, color: "var(--text-secondary)"}}>folder_managed</span>
        <div className={styles.toolPanelTabs}>
          <button
            className={`${styles.toolPanelTab} ${activeTab === 'files' ? styles.toolPanelTabActive : ''}`}
            onClick={() => setActiveTab('files')}
          >
            <span className="material-symbols-outlined">folder</span>
            文件
          </button>
          <button
            className={`${styles.toolPanelTab} ${activeTab === 'diff' ? styles.toolPanelTabActive : ''}`}
            onClick={() => setActiveTab('diff')}
          >
            <span className="material-symbols-outlined">difference</span>
            差异
          </button>
        </div>
        <button className={styles.toolPanelClose} onClick={onClose} title="关闭" aria-label="关闭工具面板">
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      <div className={styles.toolPanelSplit}>
        {activeTab === 'files' && (
          <div className={styles.fileTreeSection}>
            <div className={styles.fileTreeHeader}>
              <span className={styles.fileTreeTitle}>项目文件</span>
              <div className={styles.fileTreeActions}>
                <button className={styles.fileTreeAction} title="搜索">
                  <span className="material-symbols-outlined">search</span>
                </button>
                <button className={styles.fileTreeAction} title={fileTreeCollapsed ? '展开全部' : '收缩全部'} onClick={() => setFileTreeCollapsed((v) => !v)}>
                  <span className="material-symbols-outlined">{fileTreeCollapsed ? 'unfold_more' : 'unfold_less'}</span>
                </button>
                <button className={styles.fileTreeAction} title="刷新">
                  <span className="material-symbols-outlined">refresh</span>
                </button>
              </div>
            </div>
            <div className={styles.fileTreeBody}>
              <SafeRender>
                <FileTree nodes={fileTree} onFileClick={handleFileClick} allCollapsed={fileTreeCollapsed} />
              </SafeRender>
            </div>
          </div>
        )}

        {activeTab === 'diff' && (
          <div className={styles.diffSection}>
            <div className={styles.diffHeader}>
              <span className={styles.diffTitle}>
                差异查看器{activeDiffFile ? ` (${activeDiffFile.split('/').pop()})` : ''}
              </span>
              {diffFiles.length > 0 && (
                <div className={styles.diffActions}>
                  <button className={`${styles.diffAction} ${styles.diffActionReject}`}>拒绝</button>
                  <button className={`${styles.diffAction} ${styles.diffActionAccept}`}>通过</button>
                </div>
              )}
            </div>
            <div className={styles.diffBody}>
              <SafeRender>
                <DiffView files={diffFiles} />
              </SafeRender>
            </div>
          </div>
        )}
      </div>

      {/* Status bar — CC session data only */}
      <div className={styles.toolPanelStatus}>
        <div className={styles.toolPanelStatusRow}>
          <span>{formatTokens(inputTokens)} in</span>
          <span className={styles.statusSeparator}>/</span>
          <span>{formatTokens(outputTokens)} out</span>
          <span className={styles.statusSeparator}>·</span>
          <span>{toolCallCount} tool calls</span>
        </div>
        <div className={styles.toolPanelStatusRow}>
          <span>{userMsgCount} user · {assistantMsgCount} assistant</span>
          <span className={styles.statusSeparator}>·</span>
          <span>${estimatedCost.toFixed(2)}</span>
          <span className={styles.statusSeparator}>·</span>
          <span>+{codeChanges.added} / -{codeChanges.removed}</span>
        </div>
      </div>
    </aside>
  );
}

export { ToolPanel };
