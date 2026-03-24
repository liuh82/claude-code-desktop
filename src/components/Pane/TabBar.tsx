import { useCallback, useMemo } from 'react';
import { useTabStore } from '@/stores/useTabStore';
import { useChatStore } from '@/stores/useChatStore';
import styles from './TabBar.module.css';

function shortenModel(model: string): string {
  if (!model) return '';
  const m = model.replace(/^claude-/, '');
  return m.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

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
  const currentModel = useChatStore((s) => s.currentModel);

  const dirName = useMemo(() => {
    if (!projectPath) return '';
    return projectPath.split('/').filter(Boolean).pop() || projectPath;
  }, [projectPath]);

  const shortModel = useMemo(() => shortenModel(currentModel), [currentModel]);

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
      {(dirName || shortModel) && (
        <div className={styles.tabInfo}>
          {dirName && (
            <span className={styles.tabInfoItem}>
              <span className={`material-symbols-outlined ${styles.tabInfoIcon}`}>folder</span>
              {dirName}
            </span>
          )}
          {dirName && shortModel && <span className={styles.tabInfoSep}>·</span>}
          {shortModel && (
            <span className={styles.tabInfoItem}>
              <span className={`material-symbols-outlined ${styles.tabInfoIcon}`}>model_training</span>
              {shortModel}
            </span>
          )}
        </div>
      )}
      <div className={styles.tabList}>
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
    </div>
  );
}

export { TabBar };
