import { useState, useCallback, useRef, useEffect } from 'react';
import { useChatStore } from '@/stores/useChatStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useProjectStore } from '@/stores/useProjectStore';
import styles from './ChatHeader.module.css';

const MORE_ACTIONS = [
  { id: 'copy', label: '复制对话', icon: 'content_copy' },
  { id: 'export', label: '导出对话', icon: 'download' },
  { id: 'clear', label: '清除对话', icon: 'delete_sweep' },
  { id: 'settings', label: '设置', icon: 'settings' },
];

function ChatHeader() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const { settings } = useSettingsStore();
  const currentModel = useChatStore((s) => s.currentModel) || settings.defaultModel;
  const projectPath = activeProject?.path ?? '';
  const projectName = activeProject?.name || projectPath.split('/').pop() || '';
  const displayModel = currentModel || settings.defaultModel || 'claude-sonnet-4-6';
  const modelLabel = displayModel.replace('claude-', '').replace(/-\d{8}$/, '');

  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handleAction = useCallback((id: string) => {
    setShowMenu(false);
    if (id === 'clear') {
      const state = useChatStore.getState();
      // Clear the first (default) pane
      for (const [paneId] of state.panes) {
        useChatStore.getState().clearPane(paneId);
        useChatStore.getState().initPane(paneId, state.projectPath);
        break;
      }
    }
    if (id === 'copy') {
      const messages = useChatStore.getState().panes.values().next().value?.messages ?? [];
      const text = messages.map(m => `[${m.role}]\n${m.content}`).join('\n\n');
      navigator.clipboard.writeText(text).catch(() => {});
    }
    if (id === 'export') {
      const messages = useChatStore.getState().panes.values().next().value?.messages ?? [];
      const text = messages.map(m => `## ${m.role}\n${m.content}`).join('\n\n---\n\n');
      const blob = new Blob([text], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `claude-chat-${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
    if (id === 'settings') {
      window.dispatchEvent(new CustomEvent('ccdesk:open-settings'));
    }
  }, []);

  return (
    <header className={styles.chatHeader}>
      <div className={styles.headerLeft}>
        <div className={styles.pathPill}>
          <span className="material-symbols-outlined headerIcon">folder</span>
          <span>{projectPath ? `~/${projectName}` : '~/projects'}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.modelInfo}>
          <span className="material-symbols-outlined headerIcon">model_training</span>
          <span>{modelLabel}</span>
        </div>
      </div>
      <div className={styles.headerRight} ref={menuRef}>
        <button className={styles.moreBtn} title="更多选项" onClick={() => setShowMenu(!showMenu)}>
          <span className="material-symbols-outlined moreIcon">more_horiz</span>
        </button>
        {showMenu && (
          <div className={styles.moreMenu}>
            {MORE_ACTIONS.map((action) => (
              <button
                key={action.id}
                className={styles.moreMenuItem}
                onClick={() => handleAction(action.id)}
              >
                <span className="material-symbols-outlined">{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

export { ChatHeader };