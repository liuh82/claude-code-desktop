export interface ToolCall {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  input: Record<string, unknown>;
  output?: string;
  duration?: number;
  startTime?: number;
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

// ── Direct API (SSE streaming) types ──

export interface DirectApiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens?: number;
  maxContextMessages?: number;
}

/** SSE event types from Anthropic Messages API */
export type DirectSSEEvent =
  | { type: 'message_start'; message: { id: string; model: string; usage: { input_tokens: number } } }
  | { type: 'content_block_start'; index: number; content_block: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> } }
  | { type: 'content_block_delta'; index: number; delta: { type: string; text?: string; partial_json?: string } }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: { stop_reason: string | null }; usage: { output_tokens: number } }
  | { type: 'message_stop' }
  | { type: 'ping' };

/** Wrapped SSE event sent to renderer via claude-output channel */
export interface DirectApiOutput {
  apiMode: 'direct';
  sessionId: string;
  event: DirectSSEEvent;
}

/** API mode setting */
export type ApiMode = 'cli' | 'direct';

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
