import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useChatStore } from '@/stores/useChatStore';
import { useTabStore } from '@/stores/useTabStore';
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
  { id: 'search', icon: 'search', label: '搜索 (⌘K)' },
  { id: 'history', icon: 'history', label: '历史记录' },
] as const;

const BOTTOM_ITEMS = [
  { id: 'split-h', icon: 'vertical_split', label: '左右分栏' },
  { id: 'split-v', icon: 'horizontal_split', label: '上下分栏' },
  { id: 'settings', icon: 'settings', label: '设置' },
  { id: 'theme', icon: 'palette', label: '皮肤切换' },
] as const;

interface SidebarProps {
  projectPath: string;
  onNewChat: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onOpenHistory?: () => void;
}

function Sidebar({ projectPath: _projectPath, onNewChat: _onNewChat, onOpenSettings, onToggleTheme, onOpenHistory, style }: SidebarProps & { style?: React.CSSProperties }) {
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
    if (id === 'theme') { onToggleTheme(); return; }
    if (id === 'history') { onOpenHistory?.(); return; }
    if (id === 'search') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
      return;
    }
    if (id === 'split-h' || id === 'split-v') {
      const direction = id === 'split-h' ? 'horizontal' : 'vertical';
      const tabStore = useTabStore.getState();
      const tab = tabStore.activeTabId ? tabStore.tabs.get(tabStore.activeTabId) : null;
      if (tab) {
        tabStore.splitPane(tab.id, tab.activePaneId, direction);
      }
      return;
    }
  }, [onOpenSettings, onToggleTheme]);

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
        </div>
    </aside>
  );
}

export { Sidebar };
