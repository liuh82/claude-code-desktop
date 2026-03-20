import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Project } from '@/types/tauri';
import './ProjectManager.css';

interface ProjectManagerProps {
  onOpenProject: (project: Project) => void;
  onRefresh?: () => void;
}

type SortKey = 'name' | 'lastOpened' | 'path';
type SortDir = 'asc' | 'desc';

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  const api = (window as unknown as { claudeAPI?: Record<string, (...a: unknown[]) => Promise<unknown>> }).claudeAPI;
  if (!api) return null;
  const method = api[cmd];
  if (typeof method !== 'function') return null;
  return method(args) as Promise<T>;
}

function ProjectManager({ onOpenProject, onRefresh }: ProjectManagerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('lastOpened');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<unknown[]>('listRecentProjects');
      if (result) {
        const mapped: Project[] = (result as Array<Record<string, unknown>>).map((r: Record<string, unknown>) => ({
          id: String(r.id ?? ''),
          name: String(r.name ?? ''),
          path: String(r.path ?? ''),
          favorite: Boolean(r.favorite ?? false),
          lastOpened: Number(r.lastOpened ?? r.lastOpenedAt ?? 0),
          sessionCount: Number(r.sessionCount ?? 0),
        }));
        setProjects(mapped);
      }
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const filteredProjects = useMemo(() => {
    let list = [...projects];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'lastOpened') cmp = a.lastOpened - b.lastOpened;
      else cmp = a.path.localeCompare(b.path);
      return sortDir === 'desc' ? -cmp : cmp;
    });
    list.sort((a, b) => (a.favorite === b.favorite ? 0 : a.favorite ? -1 : 1));
    return list;
  }, [projects, searchQuery, sortKey, sortDir]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      setSortDir((prevDir) => (prev === key && prevDir === 'asc' ? 'desc' : 'asc'));
      return key;
    });
  }, []);

  const handleRemove = useCallback(async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    onRefresh?.();
  }, [onRefresh]);

  const handleToggleFavorite = useCallback(async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, favorite: !p.favorite } : p));
  }, []);

  const handleOpenProject = useCallback(async (project: Project) => {
    try {
      const updated = await invoke<Project>('openProject', { projectPath: project.path });
      if (updated) {
        setProjects((prev) => prev.map((p) => p.id === updated.id ? { ...p, lastOpened: updated.lastOpened, sessionCount: updated.sessionCount } : p));
        onOpenProject(updated);
      } else {
        onOpenProject(project);
      }
    } catch {
      onOpenProject(project);
    }
  }, [onOpenProject]);

  return (
    <div className="pm-container">
      <div className="pm-header">
        <h3 className="pm-title">Projects</h3>
        <button className="pm-refresh" onClick={loadProjects} title="Refresh" aria-label="Refresh projects">&#8635;</button>
      </div>
      <div className="pm-search">
        <input className="pm-search__input" type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search projects..." aria-label="Search projects" spellCheck={false} />
      </div>
      <div className="pm-sort-bar">
        {(['name', 'lastOpened', 'path'] as SortKey[]).map((key) => (
          <button key={key} className={`pm-sort-btn ${sortKey === key ? 'pm-sort-btn--active' : ''}`} onClick={() => handleSort(key)}>
            {key === 'lastOpened' ? 'Last Opened' : key === 'name' ? 'Name' : 'Path'}
            {sortKey === key && <span className="pm-sort-btn__dir">{sortDir === 'asc' ? ' \u2191' : ' \u2193'}</span>}
          </button>
        ))}
      </div>
      <div className="pm-list">
        {loading ? <div className="pm-empty">Loading...</div> : filteredProjects.length === 0 ? <div className="pm-empty">{searchQuery ? 'No matching projects' : 'No projects yet'}</div> : filteredProjects.map((project) => (
          <div key={project.id} className={`pm-card ${project.favorite ? 'pm-card--favorite' : ''}`} onClick={() => handleOpenProject(project)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') handleOpenProject(project); }}>
            <div className="pm-card__header">
              <span className="pm-card__name" title={project.name}>{project.favorite && <span className="pm-card__star">&#9733;</span>}{project.name}</span>
              <div className="pm-card__actions">
                <button className="pm-card__btn" onClick={(e) => handleToggleFavorite(e, project.id)} title={project.favorite ? 'Unfavorite' : 'Favorite'}>{project.favorite ? '\u2605' : '\u2606'}</button>
                <button className="pm-card__btn pm-card__btn--danger" onClick={(e) => handleRemove(e, project.id)} title="Remove">&times;</button>
              </div>
            </div>
            <div className="pm-card__path" title={project.path}>{project.path}</div>
            <div className="pm-card__meta"><span>{project.sessionCount} sessions</span><span>{formatRelativeTime(project.lastOpened)}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { ProjectManager };
