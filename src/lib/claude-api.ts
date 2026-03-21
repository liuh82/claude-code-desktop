/**
 * Claude API wrapper — calls Electron IPC when in Electron, falls back to mock in browser.
 */

interface ElectronAPI {
  getAppInfo: () => Promise<{ version: string; platform: string; arch: string }>;
  checkClaudeCli: () => Promise<{ path: string; version: string; available: boolean }>;
  getSettings: () => Promise<Record<string, unknown>>;
  saveSettings: (settings: unknown) => Promise<void>;
  createSession: (args: { projectId: string; projectPath: string }) => Promise<{ session_id: string }>;
  startSession: (args: { sessionId: string; projectPath: string; model?: string; permissionMode?: string }) => Promise<number>;
  sendInput: (args: { sessionId: string; input: string }) => Promise<void>;
  closeSession: (args: { sessionId: string }) => Promise<void>;
  listSessions: (args: { projectId: string }) => Promise<unknown[]>;
  openProject: (args: { projectPath: string }) => Promise<{ id: string; name: string; path: string; favorite: boolean; lastOpened: number; sessionCount: number }>;
  listRecentProjects: () => Promise<unknown[]>;
  openDirectoryDialog: () => Promise<string | null>;
  openInExternal: (url: string) => Promise<void>;
  onClaudeOutput: (cb: (line: string) => void) => () => void;
  onClaudeStderr: (cb: (data: string) => void) => () => void;
  onClaudeExit: (cb: (info: { sessionId: string; exitCode: number | null }) => void) => () => void;
  onClaudeError: (cb: (info: { sessionId: string; error: string }) => void) => () => void;
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
  getSettings: () => getApi()?.getSettings() ?? Promise.resolve({}),
  saveSettings: (s) => getApi()?.saveSettings(s) ?? Promise.resolve(),
  createSession: (a) => getApi()?.createSession(a) ?? Promise.resolve({ session_id: 'mock' }),
  startSession: (a) => getApi()?.startSession(a) ?? Promise.resolve(0),
  sendInput: (a) => getApi()?.sendInput(a) ?? Promise.resolve(),
  closeSession: (a) => getApi()?.closeSession(a) ?? Promise.resolve(),
  listSessions: (a) => getApi()?.listSessions(a) ?? Promise.resolve([]),
  openProject: (a) => getApi()?.openProject(a) ?? Promise.resolve({ id: '1', name: 'Mock', path: a.projectPath, favorite: false, lastOpened: Date.now(), sessionCount: 0 }),
  listRecentProjects: () => getApi()?.listRecentProjects() ?? Promise.resolve([]),
  openDirectoryDialog: () => getApi()?.openDirectoryDialog() ?? Promise.resolve(null),
  openInExternal: (u) => getApi()?.openInExternal(u) ?? Promise.resolve(),
  onClaudeOutput: (cb) => getApi()?.onClaudeOutput(cb) ?? (() => {}),
  onClaudeStderr: (cb) => getApi()?.onClaudeStderr(cb) ?? (() => {}),
  onClaudeExit: (cb) => getApi()?.onClaudeExit(cb) ?? (() => {}),
  onClaudeError: (cb) => getApi()?.onClaudeError(cb) ?? (() => {}),
};
