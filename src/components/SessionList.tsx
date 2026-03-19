import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSessionStore } from '@/stores/useSessionStore';
import type { Session } from '@/types/session';
import './SessionList.css';

interface SessionListProps {
  projectId: string | null;
  onSessionClick?: (session: Session) => void;
}

const STATUS_COLORS: Record<Session['status'], string> = {
  idle: 'sl-dot--idle',
  starting: 'sl-dot--starting',
  running: 'sl-dot--running',
  waiting: 'sl-dot--waiting',
  error: 'sl-dot--error',
  closed: 'sl-dot--closed',
};

const STATUS_LABELS: Record<Session['status'], string> = {
  idle: 'Idle',
  starting: 'Starting...',
  running: 'Running',
  waiting: 'Waiting',
  error: 'Error',
  closed: 'Closed',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function SessionList({ projectId, onSessionClick }: SessionListProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);
  const storeSessions = useSessionStore((s) => s.sessions);

  // Sync with store when available
  useEffect(() => {
    if (storeSessions.size > 0 && projectId) {
      const projectSessions = Array.from(storeSessions.values()).filter(
        (s) => s.projectId === projectId,
      );
      if (projectSessions.length > 0) {
        setSessions((prev) => {
          const merged = new Map(prev.map((s) => [s.id, s]));
          for (const s of projectSessions) {
            merged.set(s.id, s);
          }
          return Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt);
        });
      }
    }
  }, [storeSessions, projectId]);

  // Load sessions from backend
  const loadSessions = useCallback(async () => {
    if (!projectId) {
      setSessions([]);
      return;
    }
    setLoading(true);
    try {
      const result = await invoke<Session[]>('get_sessions', { projectId });
      setSessions(result.sort((a, b) => b.updatedAt - a.updatedAt));
    } catch {
      // Tauri not available
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleDoubleClick = useCallback((session: Session) => {
    if (session.status === 'closed') return;
    setEditingId(session.id);
    setEditValue(session.title);
  }, []);

  const handleRenameSubmit = useCallback(
    async (sessionId: string) => {
      const trimmed = editValue.trim();
      if (!trimmed) {
        setEditingId(null);
        return;
      }
      setEditingId(null);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: trimmed } : s)),
      );
      try {
        await invoke('rename_session', { sessionId, title: trimmed });
      } catch {
        // ignore
      }
    },
    [editValue],
  );

  const handleDelete = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      try {
        await invoke('close_session', { sessionId });
        await invoke('delete_session', { sessionId });
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } catch {
        // ignore
      }
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, sessionId: string) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRenameSubmit(sessionId);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditingId(null);
      }
    },
    [handleRenameSubmit],
  );

  if (!projectId) {
    return (
      <div className="sl-container">
        <div className="sl-header">
          <h3 className="sl-title">Sessions</h3>
        </div>
        <div className="sl-empty">Select a project to view sessions</div>
      </div>
    );
  }

  return (
    <div className="sl-container">
      <div className="sl-header">
        <h3 className="sl-title">Sessions</h3>
        <button className="sl-refresh" onClick={loadSessions} title="Refresh" aria-label="Refresh sessions">
          &#8635;
        </button>
      </div>

      <div className="sl-list">
        {loading ? (
          <div className="sl-empty">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="sl-empty">No sessions</div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`sl-item ${session.status === 'closed' ? 'sl-item--closed' : ''}`}
              onClick={() => onSessionClick?.(session)}
              onDoubleClick={() => handleDoubleClick(session)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') onSessionClick?.(session); }}
            >
              <span className={`sl-dot ${STATUS_COLORS[session.status]}`} title={STATUS_LABELS[session.status]} />
              <div className="sl-item__body">
                {editingId === session.id ? (
                  <input
                    className="sl-item__edit"
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleRenameSubmit(session.id)}
                    onKeyDown={(e) => handleKeyDown(e, session.id)}
                    autoFocus
                    spellCheck={false}
                  />
                ) : (
                  <span className="sl-item__title">{session.title}</span>
                )}
                <span className="sl-item__meta">
                  {formatTime(session.createdAt)}
                </span>
              </div>
              {session.status !== 'closed' && (
                <button
                  className="sl-item__delete"
                  onClick={(e) => handleDelete(e, session.id)}
                  title="Delete session"
                  aria-label="Delete session"
                >
                  &times;
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export { SessionList };
