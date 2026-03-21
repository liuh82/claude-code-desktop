import { useState, useMemo, useCallback } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import styles from './Sidebar.module.css';

const CLAUDE_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-haiku-4-5-20251001',
];

const GLM_MODELS = [
  'glm-5-turbo',
  'glm-4-plus',
  'glm-4-0520',
  'glm-4-air',
  'glm-4-airx',
  'glm-4-long',
  'glm-4-flash',
];

interface Session {
  id: string;
  title: string;
  projectPath: string;
  active?: boolean;
}

const MOCK_SESSIONS: Session[] = [
  { id: '1', title: 'Refactor auth module', projectPath: '/workspace/project-a', active: true },
  { id: '2', title: 'Add login page', projectPath: '/workspace/project-a' },
  { id: '3', title: 'Fix CSS bug', projectPath: '/workspace/project-a' },
  { id: '4', title: 'Setup CI pipeline', projectPath: '/workspace/project-b' },
  { id: '5', title: 'Debug API timeout', projectPath: '/workspace/project-a' },
  { id: '6', title: 'Write unit tests', projectPath: '/workspace/project-c' },
];

interface SidebarProps {
  projectPath: string;
  onNewChat: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
}

function formatModelLabel(m: string): string {
  return m.replace('claude-', '').replace(/-\d{8}$/, '');
}

function Sidebar({ projectPath, onNewChat, onClose, onOpenSettings, onToggleTheme }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { settings, updateSetting } = useSettingsStore();

  const projectName = projectPath
    ? projectPath.split('/').pop() || projectPath
    : 'No project';

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
      const key = session.projectPath.split('/').pop() || 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(session);
    }
    return groups;
  }, [filteredSessions]);

  const handleSessionClick = useCallback(() => {
    // Phase 2: switch to session
  }, []);

  return (
    <aside className={styles.sidebar}>
      {/* Top bar: project + model + actions */}
      <div className={styles.sidebarTop}>
        <div className={styles.projectRow}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={styles.projectIcon}>
            <path d="M2 4l3-2h6l3 2v8l-3 2H5l-3-2V4z" />
          </svg>
          <span className={styles.projectName} title={projectPath}>{projectName}</span>
          <button className={styles.newChatBtn} onClick={onNewChat} title="New Chat (Cmd+N)">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
          </button>
        </div>
        <div className={styles.modelRow}>
          <select
            className={styles.modelSelect}
            value={settings.defaultModel}
            onChange={(e) => updateSetting('defaultModel', e.target.value)}
            title="Select model"
          >
            <optgroup label="GLM">
              {GLM_MODELS.map((m) => (
                <option key={m} value={m}>{formatModelLabel(m)}</option>
              ))}
            </optgroup>
            <optgroup label="Claude">
              {CLAUDE_MODELS.map((m) => (
                <option key={m} value={m}>{formatModelLabel(m)}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchBox}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* Session list */}
      <div className={styles.sessionList}>
        {Object.keys(groupedSessions).length === 0 ? (
          <div className={styles.sessionEmpty}>No sessions found</div>
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
        <button className={styles.footerBtn} onClick={onToggleTheme} title="Toggle Theme">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="3.5" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
          </svg>
        </button>
        <button className={styles.footerBtn} onClick={onOpenSettings} title="Settings (Cmd+,)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="2" />
            <path d="M8 1.5l.7 1.5h1.6l-1.3 1 .5 1.6-1.5-1.1-1.5 1.1.5-1.6-1.3-1h1.6L8 1.5zM14 8l-1.5.7v1.6l-1-1.3-1.6.5 1.1-1.5-1.1-1.5 1.6.5 1-1.3V7.3L14 8zM8 14.5l-.7-1.5H5.7l1.3-1-.5-1.6 1.5 1.1 1.5-1.1-.5 1.6 1.3 1h-1.6l-.7 1.5zM2 8l1.5-.7V5.7l1 1.3 1.6-.5-1.1 1.5 1.1 1.5-1.6-.5-1 1.3V8.7L2 8z" />
          </svg>
        </button>
        <button className={styles.footerBtn} onClick={onClose} title="Close Sidebar (Cmd+B)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="9,3 4,8 9,13" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

export { Sidebar };
