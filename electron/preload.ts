import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // App
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  checkClaudeCli: () => ipcRenderer.invoke('check-claude-cli'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('save-settings', settings),

  // Sessions
  createSession: (args: { projectId: string; projectPath: string }) =>
    ipcRenderer.invoke('create-session', args),
  startSession: (args: { sessionId: string; projectPath: string; model?: string; permissionMode?: string }) =>
    ipcRenderer.invoke('start-session', args),
  sendInput: (args: { sessionId: string; input: string }) =>
    ipcRenderer.invoke('send-input', args),
  sendToSession: (args: { sessionId: string; input: string }) =>
    ipcRenderer.invoke('send-to-session', args),
  closeSession: (args: { sessionId: string }) =>
    ipcRenderer.invoke('close-session', args),
  listSessions: (args: { projectId: string }) =>
    ipcRenderer.invoke('list-sessions', args),

  // Projects
  openProject: (args: { projectPath: string }) =>
    ipcRenderer.invoke('open-project', args),
  listRecentProjects: () => ipcRenderer.invoke('list-recent-projects'),

  // Dialog
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  openInExternal: (url: string) => ipcRenderer.invoke('open-in-external', url),

  // Config
  getConfig: (args: { key: string }) => ipcRenderer.invoke('get-config', args),
  setConfig: (args: { key: string; value: unknown }) => ipcRenderer.invoke('set-config', args),

  // Events from main process (CC CLI output)
  onClaudeOutput: (callback: (line: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, line: string) => callback(line);
    ipcRenderer.on('claude-output', handler);
    return () => ipcRenderer.removeListener('claude-output', handler);
  },
  onClaudeStderr: (callback: (data: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on('claude-stderr', handler);
    return () => ipcRenderer.removeListener('claude-stderr', handler);
  },
  onClaudeExit: (callback: (info: { sessionId: string; exitCode: number | null }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: { sessionId: string; exitCode: number | null }) => callback(info);
    ipcRenderer.on('claude-exit', handler);
    return () => ipcRenderer.removeListener('claude-exit', handler);
  },
  onClaudeError: (callback: (info: { sessionId: string; error: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: { sessionId: string; error: string }) => callback(info);
    ipcRenderer.on('claude-error', handler);
    return () => ipcRenderer.removeListener('claude-error', handler);
  },
};

contextBridge.exposeInMainWorld('claudeAPI', api);
