import { useState, useEffect, useCallback } from 'react';
import { useSessionStore } from '@/stores/useSessionStore';
import type { Session } from '@/types/session';
import './SessionList.css';

interface SessionListProps {
  projectId: string | null;
  onSessionClick?: (session: Session) => void;
}

interface ElectronAPI {
  closeSession: (args: { sessionId: string }) => Promise<void>;
  listSessions: (args: { projectId: string }) => Promise<Array<Record<string, unknown>>>;
}

function getApi(): ElectronAPI | null {
  const api = (window as unknown as { claudeAPI?: ElectronAPI }).claudeAPI;
  return api ?? null;
}

const STATUS_COLORS: Record<string, string> = { idle: 'sl-dot--idle', starting: 'sl-dot--starting', running: 'sl-dot--running', waiting: 'sl-dot--waiting', error: 'sl-dot--error', closed: 'sl-dot--closed' };
const STATUS_LABELS: Record<string, string> = { idle: 'Idle', starting: 'Starting...', running: 'Running', waiting: 'Waiting', error: 'Error', closed: 'Closed' };

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function SessionList({ projectId, onSessionClick }: SessionListProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const storeSessions = useSessionStore((s) => s.sessions);

  useEffect(() => {
    if (storeSessions.size > 0 && projectId) {
      const projectSessions = Array.from(storeSessions.values()).filter((s) => s.projectId === projectId);
      if (projectSessions.length > 0) {
        setSessions((prev) => {
          const merged = new Map(prev.map((s) => [s.id, s]));
          for (const s of projectSessions) merged.set(s.id, s);
          return Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt);
        });
      }
    }
  }, [storeSessions, projectId]);

  const loadSessions = useCallback(async () => {
    if (!projectId) { setSessions([]); return; }
    setLoading(true);
    try {
      const api = getApi();
      if (!api) throw new Error('no api');
      const result = await api.listSessions({ projectId });
      setSessions(result.map((r) => ({
        id: String(r.id ?? ''),
        projectId: String(r.projectId ?? projectId),
        projectPath: String(r.projectPath ?? ''),
        paneId: String(r.paneId ?? ''),
        title: String(r.title ?? 'Untitled'),
        status: (r.status as Session['status']) ?? 'idle',
        processId: r.processId as number | undefined,
        createdAt: r.createdAt ? new Date(String(r.createdAt)).getTime() : Date.now(),
        updatedAt: r.updatedAt ? new Date(String(r.updatedAt)).getTime() : Date.now(),
      })));
    } catch { /* Tauri not available */ } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleDelete = useCallback(async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try { getApi()?.closeSession({ sessionId }); } catch { /* ignore */ }
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }, []);

  if (!projectId) {
    return <div className="sl-container"><div className="sl-header"><h3 className="sl-title">Sessions</h3></div><div className="sl-empty">Select a project to view sessions</div></div>;
  }

  return (
    <div className="sl-container">
      <div className="sl-header"><h3 className="sl-title">Sessions</h3><button className="sl-refresh" onClick={loadSessions} title="Refresh">&#8635;</button></div>
      <div className="sl-list">
        {loading ? <div className="sl-empty">Loading...</div> : sessions.length === 0 ? <div className="sl-empty">No sessions</div> : sessions.map((session) => (
          <div key={session.id} className={`sl-item ${session.status === 'closed' ? 'sl-item--closed' : ''}`} onClick={() => onSessionClick?.(session)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSessionClick?.(session); }}>
            <span className={`sl-dot ${STATUS_COLORS[session.status]}`} title={STATUS_LABELS[session.status]} />
            <div className="sl-item__body"><span className="sl-item__title">{session.title}</span><span className="sl-item__meta">{formatTime(session.createdAt)}</span></div>
            {session.status !== 'closed' && <button className="sl-item__delete" onClick={(e) => handleDelete(e, session.id)} title="Delete session">&times;</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

export { SessionList };
