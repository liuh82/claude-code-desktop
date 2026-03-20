import { create } from 'zustand';
import type { Session } from '@/types/session';

// eslint-disable-next-line @typescript-eslint/no-explicit-any

interface ElectronAPI {
  createSession: (args: { projectId: string; projectPath: string }) => Promise<{ session_id: string }>;
  startSession: (args: { sessionId: string; projectPath: string; model?: string; permissionMode?: string }) => Promise<number>;
  sendInput: (args: { sessionId: string; input: string }) => Promise<void>;
  sendToSession: (args: { sessionId: string; input: string }) => Promise<void>;
  closeSession: (args: { sessionId: string }) => Promise<void>;
  listSessions: (args: { projectId: string }) => Promise<Session[]>;
  openProject: (args: { projectPath: string }) => Promise<{ id: string; name: string; path: string; favorite: boolean; lastOpened: number; sessionCount: number }>;
  listRecentProjects: () => Promise<unknown[]>;
  getSettings: () => Promise<Record<string, unknown>>;
  saveSettings: (settings: unknown) => Promise<void>;
  getConfig: (args: { key: string }) => Promise<unknown>;
  setConfig: (args: { key: string; value: unknown }) => Promise<void>;
  getAppInfo: () => Promise<{ version: string; platform: string; arch: string }>;
  checkClaudeCli: () => Promise<{ path: string; version: string; available: boolean }>;
  openDirectoryDialog: () => Promise<string | null>;
  openInExternal: (url: string) => Promise<void>;
  onClaudeOutput: (cb: (line: string) => void) => () => void;
  onClaudeStderr: (cb: (data: string) => void) => () => void;
  onClaudeExit: (cb: (info: { sessionId: string; exitCode: number | null }) => void) => () => void;
  onClaudeError: (cb: (info: { sessionId: string; error: string }) => void) => () => void;
}

function getApi(): ElectronAPI | null {
  const api = (window as unknown as { claudeAPI?: ElectronAPI }).claudeAPI;
  return api ?? null;
}

interface SessionState {
  sessions: Map<string, Session>;
  createSession: (projectId: string, projectPath: string) => Promise<string>;
  sendInput: (sessionId: string, input: string) => Promise<void>;
}

export const useSessionStore = create<SessionState>()(() => ({
  sessions: new Map(),
  createSession: async (_projectId, _projectPath) => {
    const api = getApi();
    if (!api) return 'pending';
    try {
      const result = await api.createSession({ projectId: _projectId, projectPath: _projectPath });
      return result.session_id;
    } catch {
      return 'pending';
    }
  },
  sendInput: async (_sessionId, _input) => {
    const api = getApi();
    if (!api) return;
    try {
      await api.sendInput({ sessionId: _sessionId, input: _input });
    } catch { /* ignore */ }
  },
}));
