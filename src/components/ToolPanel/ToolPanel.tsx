import { useState, useCallback, useEffect } from 'react';
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

  // Auto-switch to diff tab when files change
  useEffect(() => {
    if (diffFiles.length > 0) {
      setActiveTab('diff');
    }
  }, [diffFiles.length]);

  const handleFileClick = useCallback((_node: FileNode) => {
    // Phase 3: open file in editor
  }, []);

  return (
    <aside className={styles.toolPanel} style={style}>
      <div className={styles.toolPanelHeader}>
        <span className={styles.toolPanelTitle}>工具面板</span>
        <button className={styles.toolPanelClose} onClick={onClose} title="关闭" aria-label="关闭工具面板">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
        </button>
      </div>

      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'files' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('files')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>folder_open</span>
          文件
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'diff' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('diff')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>difference</span>
          差异
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
