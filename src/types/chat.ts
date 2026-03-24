export interface ToolCall {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  input: Record<string, unknown>;
  output?: string;
  duration?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  timestamp: number;
  isStreaming?: boolean;
  model?: string;
}

export interface TokenUsage {
  input: number;
  output: number;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  status?: 'added' | 'modified' | 'deleted';
}

export interface DiffLine {
  type: 'add' | 'delete' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffFile {
  filePath: string;
  status: 'added' | 'modified' | 'deleted';
  hunks: DiffHunk[];
}

export interface DbMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface DbSession {
  id: string;
  title: string;
  status: string;
  messageCount: number;
  createdAt: string;
}

export interface SavedTabState {
  tabs: Array<{
    id: string;
    title: string;
    activePaneId: string;
    layout: unknown;
    panes: Array<{ id: string; tabId: string; title: string; sessionId?: string; status: string }>;
    projectPath: string;
    createdAt: number;
  }>;
  activeTabId: string | null;
  tabOrder: string[];
  projectPaths: Array<{ paneId: string; projectPath: string }>;
}
