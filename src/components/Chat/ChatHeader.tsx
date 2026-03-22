import { useChatStore } from '@/stores/useChatStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useProjectStore } from '@/stores/useProjectStore';
import styles from './ChatHeader.module.css';

function ChatHeader() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const currentModel = useChatStore((s) => s.currentModel);
  const { settings } = useSettingsStore();
  const projectPath = activeProject?.path ?? '';
  const projectName = activeProject?.name || projectPath.split('/').pop() || '';
  const displayModel = currentModel || settings.defaultModel || 'claude-sonnet-4-6';
  const modelLabel = displayModel.replace('claude-', '').replace(/-\d{8}$/, '');

  return (
    <header className={styles.chatHeader}>
      <div className={styles.headerLeft}>
        <div className={styles.pathPill}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>folder</span>
          <span>{projectPath ? `~/${projectName}` : '~/projects'}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.modelInfo}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>model_training</span>
          <span>{modelLabel}</span>
        </div>
      </div>
      <div className={styles.headerRight}>
        <button className={styles.moreBtn} title="更多选项">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>more_horiz</span>
        </button>
      </div>
    </header>
  );
}

export { ChatHeader };
