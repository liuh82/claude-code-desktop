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
  sendMessage: (args: { sessionId: string; projectPath: string; message: string; model?: string; permissionMode?: string }) =>
    ipcRenderer.invoke('send-message', args),
  sendMessageDirect: (args: { sessionId: string; projectPath: string; message: string; model?: string; permissionMode?: string }) =>
    ipcRenderer.invoke('send-message-direct', args),
  stopGeneration: (args: { sessionId: string }) =>
    ipcRenderer.invoke('stop-generation', args),
  sendInput: (args: { sessionId: string; input: string }) =>
    ipcRenderer.invoke('send-input', args),
  closeSession: (args: { sessionId: string }) =>
    ipcRenderer.invoke('close-session', args),
  listSessions: (args: { projectId: string }) =>
    ipcRenderer.invoke('list-sessions', args),
  listClaudeSessions: (args: { projectPath: string }) =>
    ipcRenderer.invoke('list-claude-sessions', args),

  // Persistence: Messages
  loadMessages: (args: { sessionId: string }) =>
    ipcRenderer.invoke('load-messages', args),
  getProjectSessions: (args: { projectPath: string }) =>
    ipcRenderer.invoke('get-project-sessions', args),
  getSessionMessages: (args: { sessionId: string }) =>
    ipcRenderer.invoke('get-session-messages', args),
  deleteSession: (args: { sessionId: string }) =>
    ipcRenderer.invoke('delete-session', args),

  // Persistence: Tab State
  saveTabState: (args: { projectPath: string; tabData: unknown }) =>
    ipcRenderer.invoke('save-tab-state', args),
  loadTabState: (args: { projectPath: string }) =>
    ipcRenderer.invoke('load-tab-state', args),

  // Projects
  openProject: (args: { projectPath: string }) =>
    ipcRenderer.invoke('open-project', args),
  listRecentProjects: () => ipcRenderer.invoke('list-recent-projects'),

  // Dialog
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  openFileDialog: (opts?: any) => ipcRenderer.invoke('open-file-dialog', opts) as Promise<string[]>,
  openInExternal: (url: string) => ipcRenderer.invoke('open-in-external', url),

  // Slash Commands
  listSlashCommands: (args: { projectPath: string }) => ipcRenderer.invoke('list-slash-commands', args) as Promise<Array<{ name: string; description: string; source: string; pluginName?: string }>>,

  // Log Viewer
  getLogs: (filter?: { level?: string; source?: string; search?: string; since?: number }) =>
    ipcRenderer.invoke('get-logs', filter),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  getLogCount: () => ipcRenderer.invoke('get-log-count'),
  getHistoryLogs: (filter?: { since?: number; until?: number; level?: string; source?: string; search?: string; offset?: number; limit?: number }) =>
    ipcRenderer.invoke('get-history-logs', filter) as Promise<{ logs: Array<{ timestamp: number; level: string; source: string; message: string }>; total: number }>,
  exportLogs: (filter?: { since?: number; until?: number; level?: string; search?: string }) =>
    ipcRenderer.invoke('export-logs', filter) as Promise<string>,

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

  // Tool Permission
  _pendingPermissionSessionIds: new Map<string, string>(),
  onToolPermissionRequest: (callback: (data: { sessionId: string; toolCall: { id: string; name: string; input: Record<string, unknown> } }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; toolCall: { id: string; name: string; input: Record<string, unknown> } }) => {
      // Track which session each pending permission belongs to (keyed by toolCallId)
      (api as any)._pendingPermissionSessionIds.set(data.toolCall.id, data.sessionId);
      callback(data);
    };
    ipcRenderer.on('tool-permission-request', handler);
    return () => ipcRenderer.removeListener('tool-permission-request', handler);
  },
  toolPermissionResponse: (granted: boolean, toolCallId?: string) => {
    // Use the most recent pending session if no toolCallId provided (backward compat)
    const ids = (api as any)._pendingPermissionSessionIds as Map<string, string>;
    let sessionId: string | undefined;
    if (toolCallId) {
      sessionId = ids.get(toolCallId);
      ids.delete(toolCallId);
    } else {
      // Fallback: use the last entry
      for (const [id, sid] of ids) {
        sessionId = sid;
        ids.delete(id);
        break;
      }
    }
    return ipcRenderer.invoke('tool-permission-response', { sessionId, granted });
  },
  onToolExecutionUpdate: (callback: (data: { sessionId: string; update: { id: string; name: string; input?: Record<string, unknown>; status: string; output?: string } }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; update: { id: string; name: string; input?: Record<string, unknown>; status: string; output?: string } }) => callback(data);
    ipcRenderer.on('tool-execution-update', handler);
    return () => ipcRenderer.removeListener('tool-execution-update', handler);
  },
  setPermissionMode: (sessionId: string, mode: string) => {
    return ipcRenderer.invoke('set-permission-mode', { sessionId, mode });
  },
};

contextBridge.exposeInMainWorld('claudeAPI', api);
