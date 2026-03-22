import { useCallback } from 'react';
import { useTabStore } from '@/stores/useTabStore';
import styles from './TabBar.module.css';

interface TabBarProps {
  projectPath: string;
}

function TabBar({ projectPath }: TabBarProps) {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabOrder = useTabStore((s) => s.tabOrder);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const createTab = useTabStore((s) => s.createTab);

  const handleNewTab = useCallback(() => {
    createTab(projectPath);
  }, [createTab, projectPath]);

  if (tabOrder.length === 0) {
    return (
      <div className={styles.tabBar}>
        <button className={styles.tabAdd} onClick={handleNewTab} title="新建会话 (⌘T)">
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>
    );
  }

  return (
    <div className={styles.tabBar}>
      {tabOrder.map((tabId) => {
        const tab = tabs.get(tabId);
        if (!tab) return null;
        const isActive = tabId === activeTabId;

        return (
          <div
            key={tabId}
            className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tabId)}
          >
            <span className={styles.tabTitle} title={tab.title}>{tab.title}</span>
            <button
              className={styles.tabClose}
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tabId);
              }}
              title="关闭 (⌘W)"
            >
              ×
            </button>
          </div>
        );
      })}
      <button className={styles.tabAdd} onClick={handleNewTab} title="新建会话 (⌘T)">
        <span className="material-symbols-outlined">add</span>
      </button>
    </div>
  );
}

export { TabBar };
