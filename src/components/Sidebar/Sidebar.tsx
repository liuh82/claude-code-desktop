import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useChatStore } from '@/stores/useChatStore';
import { claudeApi, isElectron } from '@/lib/claude-api';
import styles from './Sidebar.module.css';

interface ClaudeConfig {
  model: string;
  baseUrl: string | null;
  sonnetModel: string;
  opusModel: string;
  haikuModel: string;
}

const CC_BUILTIN_MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-opus-4-6', label: 'Opus 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
];

const NAV_ITEMS = [
  { id: 'terminal', icon: 'terminal', label: 'Terminal', color: 'var(--accent)' },
  { id: 'projects', icon: 'folder_open', label: 'Projects', color: '#6366f1' },
  { id: 'history', icon: 'history', label: 'History', color: '#f59e0b' },
  { id: 'settings', icon: 'settings', label: 'Settings', color: '#3b82f6' },
  { id: 'help', icon: 'help', label: 'Help', color: '#10b981' },
] as const;

interface SidebarProps {
  projectPath: string;
  onNewChat: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
}

function Sidebar({ projectPath: _projectPath, onNewChat, onClose, onOpenSettings, onToggleTheme, style }: SidebarProps & { style?: React.CSSProperties }) {
  const { settings, updateSetting } = useSettingsStore();
  const currentModel = useChatStore((s) => s.currentModel) || settings.defaultModel;
  const [activeNav, setActiveNav] = useState<string>('terminal');
  const [claudeConfig, setClaudeConfig] = useState<ClaudeConfig | null>(null);

  useEffect(() => {
    if (isElectron()) {
      claudeApi.getClaudeConfig().then(setClaudeConfig).catch(() => {});
    }
  }, []);

  const modelOptions = useMemo(() => {
    const list = [...CC_BUILTIN_MODELS];
    if (claudeConfig) {
      const known = new Set(list.map(m => m.id));
      for (const key of ['model', 'sonnetModel', 'opusModel', 'haikuModel'] as const) {
        const m = claudeConfig[key];
        if (m && !known.has(m)) {
          const label = m.replace('claude-', '').replace(/-\d{8}$/, '').replace(/^glm-/, 'GLM ');
          list.unshift({ id: m, label });
          known.add(m);
        }
      }
    }
    return list;
  }, [claudeConfig]);

  const handleNavClick = useCallback((id: string) => {
    setActiveNav(id);
    if (id === 'terminal') onNewChat();
    if (id === 'settings') onOpenSettings();
  }, [onNewChat, onOpenSettings]);

  return (
    <aside className={styles.sidebar} style={style}>
      <div className={styles.sidebarLogo}>
        <div className={styles.sidebarLogoIcon}>
          <span className="material-symbols-outlined">terminal</span>
        </div>
        <div className={styles.sidebarLogoText}>
          <span className={styles.sidebarLogoTitle}>Claude Code</span>
          <span className={styles.sidebarLogoSubtitle}>CLI Workspace</span>
        </div>
      </div>

      <div className={styles.modelRow}>
        <select
          className={styles.modelSelect}
          value={currentModel}
          onChange={(e) => updateSetting('defaultModel', e.target.value)}
          title="选择模型"
        >
          {modelOptions.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      <nav className={styles.sidebarNav}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`${styles.navItem} ${activeNav === item.id ? styles.navItemActive : ''}`}
            onClick={() => handleNavClick(item.id)}
          >
            <span className={styles.navIcon} style={{ color: activeNav === item.id ? item.color : undefined }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{item.icon}</span>
            </span>
            <span className={styles.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.userCard}>
          <div className={styles.userAvatar}>
            <span className="material-symbols-outlined">person</span>
          </div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>Developer</div>
            <div className={styles.userPlan}>Pro Plan</div>
          </div>
        </div>
        <div className={styles.sidebarActions}>
          <button className={styles.footerBtn} onClick={onToggleTheme} title="切换主题">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>dark_mode</span>
          </button>
          <button className={styles.footerBtn} onClick={onOpenSettings} title="设置">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>settings</span>
          </button>
          <button className={styles.footerBtn} onClick={onClose} title="关闭侧栏 (⌘B)">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export { Sidebar };
