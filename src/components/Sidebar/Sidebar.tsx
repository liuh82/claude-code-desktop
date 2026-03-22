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
  { id: 'editor', icon: 'code', label: '编辑器' },
  { id: 'search', icon: 'search', label: '搜索' },
  { id: 'history', icon: 'history', label: '历史记录' },
  { id: 'extensions', icon: 'extension', label: '扩展' },
] as const;

const BOTTOM_ITEMS = [
  { id: 'settings', icon: 'settings', label: '设置' },
] as const;

interface SidebarProps {
  projectPath: string;
  onNewChat: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
}

function Sidebar({ projectPath: _projectPath, onNewChat: _onNewChat, onOpenSettings, style }: SidebarProps & { style?: React.CSSProperties }) {
  const { settings, updateSetting } = useSettingsStore();
  const currentModel = useChatStore((s) => s.currentModel) || settings.defaultModel;
  const [activeNav] = useState<string>('editor');
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
    if (id === 'settings') { onOpenSettings(); return; }
  }, [onOpenSettings]);

  return (
    <aside className={styles.sidebar} style={style}>
      {/* Logo — Orange "C" */}
      <div className={styles.sidebarLogo}>
        <div className={styles.sidebarLogoImg}>
          C
        </div>
      </div>

      {/* Model selector */}
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

      {/* Navigation */}
      <nav className={styles.sidebarNav}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`${styles.navItem} ${activeNav === item.id ? styles.navItemActive : ''}`}
            onClick={() => handleNavClick(item.id)}
            title={item.label}
          >
            <span className={styles.navIcon}>
              <span className="material-symbols-outlined" >{item.icon}</span>
            </span>
          </button>
        ))}
      </nav>

        <div className={styles.sidebarBottom}>
          {BOTTOM_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`${styles.navItem} ${activeNav === item.id ? styles.navItemActive : ''}`}
              onClick={() => handleNavClick(item.id)}
              title={item.label}
            >
              <span className={styles.navIcon}>
                <span className="material-symbols-outlined" >{item.icon}</span>
              </span>
            </button>
          ))}
          <div className={styles.userAvatar}>
            <span className="material-symbols-outlined">person</span>
          </div>
        </div>
    </aside>
  );
}

export { Sidebar };
