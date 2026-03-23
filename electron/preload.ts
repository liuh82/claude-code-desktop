import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // App
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  checkClaudeCli: () => ipcRenderer.invoke('check-claude-cli'),
  readDirectory: (args: { dirPath: string; maxDepth?: number }) => ipcRenderer.invoke('read-directory', args) as Promise<Array<{ name: string; path: string; type: string; children?: unknown[] }>>,
  readFile: (args: { filePath: string }) => ipcRenderer.invoke('read-file', args) as Promise<{ content: string | null; error: string | null }>,
  
  getClaudeConfig: () => ipcRenderer.invoke('get-claude-config'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('save-settings', settings),

  // Sessions
  createSession: (args: { projectId: string; projectPath: string }) =>
    ipcRenderer.invoke('create-session', args),
  startSession: (args: { sessionId: string; projectPath: string; model?: string; permissionMode?: string }) =>
    ipcRenderer.invoke('start-session', args),
  sendMessage: (args: { sessionId: string; projectPath: string; message: string; model?: string }) =>
    ipcRenderer.invoke('send-message', args),
  stopGeneration: (args: { sessionId: string }) =>
    ipcRenderer.invoke('stop-generation', args),
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
  onClaudeOutput: (callback: (line: string, sessionId: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, line: string, sessionId: string) => callback(line, sessionId);
    ipcRenderer.on('claude-output', handler);
    return () => ipcRenderer.removeListener('claude-output', handler);
  },
  onClaudeStderr: (callback: (data: string, sessionId: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: string, sessionId: string) => callback(data, sessionId);
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
