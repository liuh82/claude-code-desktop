import { useState, useMemo, useCallback, useEffect } from 'react';
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

interface Session {
  id: string;
  title: string;
  projectPath: string;
  active: boolean;
  lastActivity: string;
}

const MOCK_SESSIONS: Session[] = [
  { id: '1', title: '实现用户登录功能', projectPath: '/projects/myapp', active: false, lastActivity: '2 小时前' },
  { id: '2', title: '修复支付模块 bug', projectPath: '/projects/myapp', active: false, lastActivity: '5 小时前' },
  { id: '3', title: '数据库迁移方案', projectPath: '/projects/api-server', active: true, lastActivity: '刚刚' },
];

interface SidebarProps {
  projectPath: string;
  onNewChat: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
}

function Sidebar({ projectPath, onNewChat, onClose, onOpenSettings, onToggleTheme, style }: SidebarProps & { style?: React.CSSProperties }) {
  const [searchQuery, setSearchQuery] = useState('');
  const { settings, updateSetting } = useSettingsStore();
  const currentModel = useChatStore((s) => s.currentModel) || settings.defaultModel;
  const [claudeConfig, setClaudeConfig] = useState<ClaudeConfig | null>(null);

  // Load CC config on mount
  useEffect(() => {
    if (isElectron()) {
      claudeApi.getClaudeConfig().then(setClaudeConfig).catch(() => {});
    }
  }, []);

  // Build model list dynamically from CC config
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

  const projectName = projectPath
    ? projectPath.split('/').pop() || projectPath
    : '无项目';

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_SESSIONS;
    const q = searchQuery.toLowerCase();
    return MOCK_SESSIONS.filter(
      (s) => s.title.toLowerCase().includes(q) || s.projectPath.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const groupedSessions = useMemo(() => {
    const groups: Record<string, Session[]> = {};
    for (const session of filteredSessions) {
      const key = session.projectPath.split('/').pop() || '其他';
      if (!groups[key]) groups[key] = [];
      groups[key].push(session);
    }
    return groups;
  }, [filteredSessions]);

  const handleSessionClick = useCallback(() => {
    // Phase 2: switch to session
  }, []);

  return (
    <aside className={styles.sidebar} style={style}>
      {/* Top bar: project + model + actions */}
      <div className={styles.sidebarTop}>
        <div className={styles.projectRow}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={styles.projectIcon}>
            <path d="M2 4l3-2h6l3 2v8l-3 2H5l-3-2V4z" />
          </svg>
          <span className={styles.projectName} title={projectPath}>{projectName}</span>
          <button className={styles.newChatBtn} onClick={onNewChat} title="新建对话 (⌘N)">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
          </button>
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
      </div>

      {/* Search */}
      <div className={styles.searchBox}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="搜索会话..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* Session list */}
      <div className={styles.sessionList}>
        {Object.keys(groupedSessions).length === 0 ? (
          <div className={styles.sessionEmpty}>暂无会话</div>
        ) : (
          Object.entries(groupedSessions).map(([project, sessions]) => (
            <div key={project} className={styles.sessionGroup}>
              <div className={styles.sessionGroupLabel}>{project}</div>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`${styles.sessionItem} ${session.active ? styles.sessionItemActive : ''}`}
                  onClick={handleSessionClick}
                >
                  <span className={styles.sessionIcon}>{session.active ? '🔥' : '💬'}</span>
                  <span className={styles.sessionLabel}>{session.title}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Bottom actions */}
      <div className={styles.sidebarFooter}>
        <button className={styles.footerBtn} onClick={onToggleTheme} title="切换主题">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="3.5" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
          </svg>
        </button>
        <button className={styles.footerBtn} onClick={onOpenSettings} title="设置 (⌘,)">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="2" />
            <path d="M8 1.5l.7 1.5h1.6l-1.3 1 .5 1.6-1.5-1.1-1.5 1.1.5-1.6-1.3-1h1.6L8 1.5zM14 8l-1.5.7v1.6l-1-1.3-1.6.5 1.1-1.5-1.1-1.5 1.6.5 1-1.3V7.3L14 8zM8 14.5l-.7-1.5H5.7l1.3-1-.5-1.6 1.5 1.1 1.5-1.1-.5 1.6 1.3 1h-1.6l-.7 1.5zM2 8l1.5-.7V5.7l1 1.3 1.6-.5-1.1 1.5 1.1 1.5-1.6-.5-1 1.3V8.7L2 8z" />
          </svg>
        </button>
        <button className={styles.footerBtn} onClick={onClose} title="关闭侧栏 (⌘B)">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="9,3 4,8 9,13" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

export { Sidebar };
