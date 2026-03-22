import { useCallback } from 'react';
import { useChatStore } from '@/stores/useChatStore';
import { FileTree } from './FileTree';
import { DiffView } from './DiffView';
import { SafeRender } from './SafeRender';
import type { FileNode } from '@/types/chat';
import styles from './ToolPanel.module.css';

interface ToolPanelProps {
  onClose: () => void;
}

function ToolPanel({ onClose, style }: ToolPanelProps & { style?: React.CSSProperties }) {
  const fileTree = useChatStore((s) => s.fileTree);
  const diffFiles = useChatStore((s) => s.diffFiles);
  const activeDiffFile = diffFiles.length > 0 ? diffFiles[0].filePath : '';

  const handleFileClick = useCallback((_node: FileNode) => {
    // Phase 3: open file in editor
  }, []);

  return (
    <aside className={styles.toolPanel} style={style}>
      <div className={styles.toolPanelHeader}>
        <span className={styles.toolPanelTitle}>工具面板</span>
        <button className={styles.toolPanelClose} onClick={onClose} title="关闭" aria-label="关闭工具面板">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
        </button>
      </div>

      <div className={styles.toolPanelSplit}>
        {/* File Tree — top section */}
        <div className={styles.fileTreeSection}>
          <div className={styles.fileTreeHeader}>
            <span className={styles.fileTreeTitle}>项目文件</span>
            <div className={styles.fileTreeActions}>
              <button className={styles.fileTreeAction} title="搜索">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>search</span>
              </button>
              <button className={styles.fileTreeAction} title="刷新">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
              </button>
            </div>
          </div>
          <div className={styles.fileTreeBody}>
            <SafeRender>
              <FileTree nodes={fileTree} onFileClick={handleFileClick} />
            </SafeRender>
          </div>
        </div>

        {/* Diff Viewer — bottom section */}
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
      </div>
    </aside>
  );
}

export { ToolPanel };
