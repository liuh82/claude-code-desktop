import { useSettingsStore } from '@/stores/useSettingsStore';
import styles from './Toolbar.module.css';

const MODEL_OPTIONS = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-haiku-4-5-20251001',
];

interface ToolbarProps {
  projectPath: string;
  onToggleSidebar: () => void;
  onToggleToolPanel: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
}

function Toolbar({ projectPath, onToggleSidebar, onToggleToolPanel, onNewChat, onOpenSettings }: ToolbarProps) {
  const { settings, updateSetting } = useSettingsStore();

  const projectName = projectPath
    ? projectPath.split('/').pop() || projectPath
    : 'No project';

  return (
    <div className={styles.toolbar}>
      {/* Sidebar toggle */}
      <button className={styles.toolbarBtn} onClick={onToggleSidebar} title="Toggle Sidebar (Cmd+B)" aria-label="Toggle sidebar">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="2" width="14" height="12" rx="2" />
          <line x1="5" y1="2" x2="5" y2="14" />
        </svg>
      </button>

      {/* New chat */}
      <button className={styles.newChatBtn} onClick={onNewChat} title="New Chat (Cmd+N)">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="8" y1="3" x2="8" y2="13" />
          <line x1="3" y1="8" x2="13" y2="8" />
        </svg>
        Chat
      </button>

      <div className={styles.toolbarDivider} />

      {/* Project path */}
      <div className={styles.projectPath} title={projectPath || 'No project selected'}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4l3-2h6l3 2v8l-3 2H5l-3-2V4z" />
        </svg>
        <span>{projectName}</span>
      </div>

      {/* Git branch placeholder */}
      <div className={styles.gitBranch}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="12" cy="8" r="1.5" />
          <path d="M5 4.5v6M5 10c0-1.5 3-2 3-2h4" />
        </svg>
        <span>main</span>
      </div>

      <div className={styles.toolbarSpacer} />

      {/* Model selector */}
      <select
        className={styles.modelSelect}
        value={settings.defaultModel}
        onChange={(e) => updateSetting('defaultModel', e.target.value)}
        title="Select model"
      >
        {MODEL_OPTIONS.map((m) => (
          <option key={m} value={m}>{m.replace('claude-', '').replace(/-\d{8}$/, '')}</option>
        ))}
      </select>

      {/* Tool panel toggle */}
      <button className={styles.toolbarBtn} onClick={onToggleToolPanel} title="Toggle Tool Panel (Cmd+Shift+F)" aria-label="Toggle tool panel">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="2" width="14" height="12" rx="2" />
          <line x1="11" y1="2" x2="11" y2="14" />
        </svg>
      </button>

      {/* Settings */}
      <button className={styles.toolbarBtn} onClick={onOpenSettings} title="Settings (Cmd+,)" aria-label="Open settings">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="2.5" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13" />
        </svg>
      </button>
    </div>
  );
}

export { Toolbar };
