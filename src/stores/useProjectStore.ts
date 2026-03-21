import { create } from 'zustand';

interface Project {
  id: string;
  name: string;
  path: string;
  lastOpened: number;
}

const PROJECTS_KEY = 'ccdesk-recent-projects';
const MAX_PROJECTS = 10;

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProjects(projects: Project[]) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch { /* ignore */ }
}

interface ProjectState {
  projects: Project[];
  activeProject: Project | null;
  selectProject: (project: Project) => void;
  addProject: (path: string) => Project;
  removeProject: (id: string) => void;
  loadProjects: () => void;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  activeProject: null,

  loadProjects: () => {
    const projects = loadProjects();
    set({ projects });
  },

  selectProject: (project: Project) => {
    // Move to top of recent list
    const projects = get().projects.filter((p) => p.id !== project.id);
    const updated = [{ ...project, lastOpened: Date.now() }, ...projects].slice(0, MAX_PROJECTS);
    saveProjects(updated);
    set({ activeProject: project, projects: updated });
  },

  addProject: (path: string) => {
    const name = path.split('/').pop() || path;
    const project: Project = {
      id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      path,
      lastOpened: Date.now(),
    };
    get().selectProject(project);
    return project;
  },

  removeProject: (id: string) => {
    const projects = get().projects.filter((p) => p.id !== id);
    saveProjects(projects);
    const state: Partial<ProjectState> = { projects };
    if (get().activeProject?.id === id) {
      state.activeProject = null;
    }
    set(state);
  },
}));
