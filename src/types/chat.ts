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
}

export interface TokenUsage {
  input: number;
  output: number;
}
