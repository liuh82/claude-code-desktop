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

function flattenFileCount(nodes: FileNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'file') count++;
    if (node.children) count += flattenFileCount(node.children);
  }
  return count;
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
    // Find the active pane's messages — useChatStore panes keyed by paneId,
    // tab store has activePaneId per tab
    const tab = useTabStore.getState().tabs.get(activeTabId);
    if (!tab) return null;
    return s.panes.get(tab.activePaneId) ?? null;
  });

  const activeDiffFile = diffFiles.length > 0 ? diffFiles[0].filePath : '';
  const [activeTab, setActiveTab] = useState<'files' | 'diff'>('files');

  const handleFileClick = useCallback((_node: FileNode) => {
    // Phase 3: open file in editor
  }, []);

  // Status bar data
  const fileCount = useMemo(() => flattenFileCount(fileTree), [fileTree]);
  const messageCount = pane?.messages.length ?? 0;
  const inputTokens = pane?.tokenUsage.input ?? 0;
  const outputTokens = pane?.tokenUsage.output ?? 0;

  // Compute added/removed lines from diff data
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
        {/* File Tree — shown when files tab active */}
        {activeTab === 'files' && (
          <div className={styles.fileTreeSection}>
            <div className={styles.fileTreeHeader}>
              <span className={styles.fileTreeTitle}>项目文件</span>
              <div className={styles.fileTreeActions}>
                <button className={styles.fileTreeAction} title="搜索">
                  <span className="material-symbols-outlined">search</span>
                </button>
                <button className={styles.fileTreeAction} title="刷新">
                  <span className="material-symbols-outlined">refresh</span>
                </button>
              </div>
            </div>
            <div className={styles.fileTreeBody}>
              <SafeRender>
                <FileTree nodes={fileTree} onFileClick={handleFileClick} />
              </SafeRender>
            </div>
          </div>
        )}

        {/* Diff Viewer — shown when diff tab active */}
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

      {/* Status bar */}
      <div className={styles.toolPanelStatus}>
        <span>{fileCount} 文件</span>
        <span className={styles.statusSeparator}>·</span>
        <span>{messageCount} 调用</span>
        <span className={styles.statusSeparator}>·</span>
        <span>{formatTokens(inputTokens)} in</span>
        <span className={styles.statusSeparator}>/</span>
        <span>{formatTokens(outputTokens)} out</span>
        <span className={styles.statusSeparator}>·</span>
        <span>+{codeChanges.added} / -{codeChanges.removed}</span>
      </div>
    </aside>
  );
}

export { ToolPanel };
