import type { Tab } from './tab';
import type { AppSettings } from '@/stores/useSettingsStore';

export interface Project {
  id: string;
  name: string;
  path: string;
  favorite: boolean;
  lastOpened: number;
  sessionCount: number;
}

// Electron API types — matches preload.ts exposure
declare global {
  interface Window {
    claudeAPI: {
      getAppInfo: () => Promise<{ version: string; platform: string; arch: string }>;
      checkClaudeCli: () => Promise<{ path: string; version: string; available: boolean }>;
      getSettings: () => Promise<Record<string, unknown>>;
      saveSettings: (settings: unknown) => Promise<void>;
      createSession: (args: { projectId: string; projectPath: string }) => Promise<{ session_id: string }>;
      startSession: (args: { sessionId: string; projectPath: string; model?: string; permissionMode?: string }) => Promise<number>;
      sendInput: (args: { sessionId: string; input: string }) => Promise<void>;
      sendToSession: (args: { sessionId: string; input: string }) => Promise<void>;
      closeSession: (args: { sessionId: string }) => Promise<void>;
      listSessions: (args: { projectId: string }) => Promise<unknown[]>;
      openProject: (args: { projectPath: string }) => Promise<Project>;
      listRecentProjects: () => Promise<unknown[]>;
      openDirectoryDialog: () => Promise<string | null>;
      openInExternal: (url: string) => Promise<void>;
      getConfig: (args: { key: string }) => Promise<unknown>;
      setConfig: (args: { key: string; value: unknown }) => Promise<void>;
      onClaudeOutput: (cb: (line: string) => void) => () => void;
      onClaudeStderr: (cb: (data: string) => void) => () => void;
      onClaudeExit: (cb: (info: { sessionId: string; exitCode: number | null }) => void) => () => void;
      onClaudeError: (cb: (info: { sessionId: string; error: string }) => void) => () => void;
    };
  }
}
