import { useState } from 'react';
import styles from './ToolPanel.module.css';

type TabId = 'files' | 'diff';

interface ToolPanelProps {
  onClose: () => void;
}

function ToolPanel({ onClose }: ToolPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('files');

  return (
    <aside className={styles.toolPanel}>
      <div className={styles.toolPanelHeader}>
        <span className={styles.toolPanelTitle}>Tool Panel</span>
        <button className={styles.toolPanelClose} onClick={onClose} title="Close (Cmd+Shift+F)" aria-label="Close tool panel">
          &#9654;
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
        {activeTab === 'files' ? (
          <div className={styles.placeholder}>
            <div className={styles.placeholderIcon}>{'\uD83D\uDCC1'}</div>
            <span>File tree will appear here</span>
            <span style={{ fontSize: '11px' }}>Phase 5: Project file browser</span>
          </div>
        ) : (
          <div className={styles.placeholder}>
            <div className={styles.placeholderIcon}>{'\uD83D\uDCDD'}</div>
            <span>Diff view will appear here</span>
            <span style={{ fontSize: '11px' }}>Phase 5: Change preview</span>
          </div>
        )}
      </div>
    </aside>
  );
}

export { ToolPanel };
