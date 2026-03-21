import { useEffect } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import styles from './ProjectSelector.module.css';

interface ProjectSelectorProps {
  onProjectOpen: (path: string) => void;
}

export function ProjectSelector({ onProjectOpen }: ProjectSelectorProps) {
  const { projects, activeProject, loadProjects, selectProject, removeProject } = useProjectStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleOpenFolder = async () => {
    // Try Electron API first, fallback to mock
    const api = (window as unknown as Record<string, unknown>).claudeAPI as { openDirectoryDialog?: () => Promise<string | null> } | undefined;
    if (api?.openDirectoryDialog) {
      const path = await api.openDirectoryDialog();
      if (path) {
        useProjectStore.getState().addProject(path);
        onProjectOpen(path);
      }
    } else {
      // Mock: prompt for path in browser
      const path = prompt('输入项目目录路径：');
      if (path?.trim()) {
        useProjectStore.getState().addProject(path.trim());
        onProjectOpen(path.trim());
      }
    }
  };

  const handleSelectProject = (path: string) => {
    const project = projects.find((p) => p.path === path);
    if (project) {
      selectProject(project);
      onProjectOpen(path);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} 小时前`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} 天前`;
    return d.toLocaleDateString('zh-CN');
  };

  const recentProjects = projects
    .filter((p) => p.id !== activeProject?.id)
    .slice(0, 5);

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.logo}>CCDesk</div>
          <div className={styles.tagline}>选择一个项目开始工作</div>
        </div>

        <button className={styles.openBtn} onClick={handleOpenFolder}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 10l3-3h6l3 3M8 2v10" />
          </svg>
          打开项目目录
        </button>

        {recentProjects.length > 0 && (
          <div className={styles.recentSection}>
            <div className={styles.recentTitle}>最近项目</div>
            <div className={styles.recentList}>
              {recentProjects.map((project) => (
                <div key={project.id} className={styles.recentItem}>
                  <span className={styles.recentIcon}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M1.5 3.5v9a1 1 0 001 1h11a1 1 0 001-1v-7a1 1 0 00-1-1H8l-1.5-2H2.5a1 1 0 00-1 1z" fill="var(--accent-muted)" />
                    </svg>
                  </span>
                  <div
                    className={styles.recentInfo}
                    onClick={() => handleSelectProject(project.path)}
                  >
                    <div className={styles.recentName}>{project.name}</div>
                    <div className={styles.recentPath}>{project.path} · {formatTime(project.lastOpened)}</div>
                  </div>
                  <button
                    className={styles.recentRemove}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProject(project.id);
                    }}
                    title="移除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.footer}>
          选择包含代码项目的目录
        </div>
      </div>
    </div>
  );
}
