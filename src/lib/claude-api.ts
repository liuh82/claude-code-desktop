/**
 * Claude API wrapper — calls Electron IPC when in Electron, falls back to mock in browser.
 */

import type { DbMessage, DbSession, SavedTabState } from '@/types/chat';

interface ElectronAPI {
  getAppInfo: () => Promise<{ version: string; platform: string; arch: string }>;
  checkClaudeCli: () => Promise<{ path: string; version: string; available: boolean }>;
  getClaudeConfig: () => Promise<{ model: string; baseUrl: string | null; sonnetModel: string; opusModel: string; haikuModel: string } | null>;
  readDirectory: (args: { dirPath: string; maxDepth?: number }) => Promise<unknown[]>;
  readFile: (args: { filePath: string }) => Promise<{ content: string | null; error: string | null }>;
  getSettings: () => Promise<Record<string, unknown>>;
  saveSettings: (settings: unknown) => Promise<void>;
  createSession: (args: { projectId: string; projectPath: string }) => Promise<{ session_id: string }>;
  startSession: (args: { sessionId: string; projectPath: string; model?: string; permissionMode?: string }) => Promise<number>;
  sendMessage: (args: { sessionId: string; projectPath: string; message: string; model?: string }) => Promise<void>;
  sendMessageDirect: (args: { sessionId: string; projectPath: string; message: string; model?: string }) => Promise<void>;
  stopGeneration: (args: { sessionId: string }) => Promise<void>;
  sendInput: (args: { sessionId: string; input: string }) => Promise<void>;
  closeSession: (args: { sessionId: string }) => Promise<void>;
  listSessions: (args: { projectId: string }) => Promise<unknown[]>;
  listClaudeSessions: (args: { projectPath: string }) => Promise<Array<{ sessionId: string; preview: string; lastUsed: number; messageCount: number }>>;
  openProject: (args: { projectPath: string }) => Promise<{ id: string; name: string; path: string; favorite: boolean; lastOpened: number; sessionCount: number }>;
  listRecentProjects: () => Promise<unknown[]>;
  openDirectoryDialog: () => Promise<string | null>;
  openFileDialog: (opts?: any) => Promise<string[]>;
  openInExternal: (url: string) => Promise<void>;
  listSlashCommands: (args: { projectPath: string }) => Promise<Array<{ name: string; description: string; source: string; pluginName?: string }>>;
  onClaudeOutput: (cb: (line: string, sessionId: string) => void) => () => void;
  onClaudeStderr: (cb: (data: string, sessionId: string) => void) => () => void;
  onClaudeExit: (cb: (info: { sessionId: string; exitCode: number | null }) => void) => () => void;
  onClaudeError: (cb: (info: { sessionId: string; error: string }) => void) => () => void;
  // Persistence
  loadMessages: (args: { sessionId: string }) => Promise<DbMessage[]>;
  getProjectSessions: (args: { projectPath: string }) => Promise<DbSession[]>;
  getSessionMessages: (args: { sessionId: string }) => Promise<DbMessage[]>;
  deleteSession: (args: { sessionId: string }) => Promise<void>;
  saveTabState: (args: { projectPath: string; tabData: unknown }) => Promise<void>;
  loadTabState: (args: { projectPath: string }) => Promise<SavedTabState | null>;
}

function getApi(): ElectronAPI | null {
  const api = (window as unknown as Record<string, ElectronAPI>).claudeAPI;
  return api ?? null;
}

export function isElectron(): boolean {
  return getApi() !== null;
}

export const claudeApi: ElectronAPI = {
  getAppInfo: () => getApi()?.getAppInfo() ?? Promise.resolve({ version: '0.2.0', platform: 'web', arch: 'unknown' }),
  checkClaudeCli: () => getApi()?.checkClaudeCli() ?? Promise.resolve({ path: '', version: '', available: false }),
  getClaudeConfig: () => getApi()?.getClaudeConfig() ?? Promise.resolve(null),
  readDirectory: (a) => getApi()?.readDirectory(a) ?? Promise.resolve([]),
  readFile: (a) => getApi()?.readFile(a) ?? Promise.resolve({ content: null, error: 'Not in Electron' }),
  getSettings: () => getApi()?.getSettings() ?? Promise.resolve({}),
  saveSettings: (s) => getApi()?.saveSettings(s) ?? Promise.resolve(),
  createSession: (a) => getApi()?.createSession(a) ?? Promise.resolve({ session_id: 'mock' }),
  startSession: (a) => getApi()?.startSession(a) ?? Promise.resolve(0),
  sendMessage: (a) => getApi()?.sendMessage(a) ?? Promise.resolve(),
  sendMessageDirect: (a) => getApi()?.sendMessageDirect(a) ?? Promise.resolve(),
  stopGeneration: (a) => getApi()?.stopGeneration(a) ?? Promise.resolve(),
  sendInput: (a) => getApi()?.sendInput(a) ?? Promise.resolve(),
  closeSession: (a) => getApi()?.closeSession(a) ?? Promise.resolve(),
  listSessions: (a) => getApi()?.listSessions(a) ?? Promise.resolve([]),
  listClaudeSessions: (a) => getApi()?.listClaudeSessions(a) ?? Promise.resolve([]),
  openProject: (a) => getApi()?.openProject(a) ?? Promise.resolve({ id: '1', name: 'Mock', path: a.projectPath, favorite: false, lastOpened: Date.now(), sessionCount: 0 }),
  listRecentProjects: () => getApi()?.listRecentProjects() ?? Promise.resolve([]),
  openDirectoryDialog: () => getApi()?.openDirectoryDialog() ?? Promise.resolve(null),
  openFileDialog: (o) => getApi()?.openFileDialog(o) ?? Promise.resolve([]),
  openInExternal: (u) => getApi()?.openInExternal(u) ?? Promise.resolve(),
  listSlashCommands: (a) => getApi()?.listSlashCommands(a) ?? Promise.resolve([]),
  onClaudeOutput: (cb) => getApi()?.onClaudeOutput(cb) ?? (() => {}),
  onClaudeStderr: (cb) => getApi()?.onClaudeStderr(cb) ?? (() => {}),
  onClaudeExit: (cb) => getApi()?.onClaudeExit(cb) ?? (() => {}),
  onClaudeError: (cb) => getApi()?.onClaudeError(cb) ?? (() => {}),
  // Persistence fallbacks
  loadMessages: (a) => getApi()?.loadMessages(a) ?? Promise.resolve([]),
  getProjectSessions: (a) => getApi()?.getProjectSessions(a) ?? Promise.resolve([]),
  getSessionMessages: (a) => getApi()?.getSessionMessages(a) ?? Promise.resolve([]),
  deleteSession: (a) => getApi()?.deleteSession(a) ?? Promise.resolve(),
  saveTabState: (a) => getApi()?.saveTabState(a) ?? Promise.resolve(),
  loadTabState: (a) => getApi()?.loadTabState(a) ?? Promise.resolve(null),
};
