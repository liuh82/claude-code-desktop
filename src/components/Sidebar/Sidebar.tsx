import { useState, useMemo, useCallback } from 'react';
import styles from './Sidebar.module.css';

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
  onNewChat: () => void;
  onClose: () => void;
}

function Sidebar({ onNewChat, onClose }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

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
      <div className={styles.sidebarHeader}>
        <span className={styles.sidebarTitle}>Sessions</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className={styles.sidebarClose} onClick={onNewChat} title="New Session (Cmd+N)" aria-label="New session">
            +
          </button>
          <button className={styles.sidebarClose} onClick={onClose} title="Close (Cmd+B)" aria-label="Close sidebar">
            &#9664;
          </button>
        </div>
      </div>

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
                  <span className={styles.sessionIcon}>{session.active ? '\uD83D\uDD25' : '\uD83D\uDCAC'}</span>
                  <span className={styles.sessionLabel}>{session.title}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

export { Sidebar };
