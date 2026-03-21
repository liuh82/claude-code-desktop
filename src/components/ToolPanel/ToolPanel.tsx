import { useState, useCallback } from 'react';
import { useChatStore } from '@/stores/useChatStore';
import { FileTree } from './FileTree';
import { DiffView } from './DiffView';
import { SafeRender } from './SafeRender';
import type { FileNode } from '@/types/chat';
import styles from './ToolPanel.module.css';

type TabId = 'files' | 'diff';

interface ToolPanelProps {
  onClose: () => void;
}

function ToolPanel({ onClose, style }: ToolPanelProps & { style?: React.CSSProperties }) {
  const [activeTab, setActiveTab] = useState<TabId>('files');
  const fileTree = useChatStore((s) => s.fileTree);
  const diffFiles = useChatStore((s) => s.diffFiles);

  const handleFileClick = useCallback((_node: FileNode) => {
    // Phase 3: open file in editor
  }, []);

  return (
    <aside className={styles.toolPanel} style={style}>
      <div className={styles.toolPanelHeader}>
        <span className={styles.toolPanelTitle}>工具面板</span>
        <button className={styles.toolPanelClose} onClick={onClose} title="Close (Cmd+Shift+F)" aria-label="Close tool panel">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="5,3 10,8 5,13" />
          </svg>
        </button>
      </div>

      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'files' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('files')}
        >
          Files
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'diff' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('diff')}
        >
          Diff
        </button>
      </div>

      <div className={styles.toolPanelBody}>
        <SafeRender>
          {activeTab === 'files' ? (
            <FileTree nodes={fileTree} onFileClick={handleFileClick} />
          ) : (
            <DiffView files={diffFiles} />
          )}
        </SafeRender>
      </div>
    </aside>
  );
}

export { ToolPanel };
