/**
 * Parse Claude CLI stream-json output.
 *
 * Real output format (verified with claude --output-format stream-json --verbose -p "test"):
 *
 * 1. system messages (init, hooks):
 *    {"type":"system","subtype":"init","session_id":"...","model":"glm-5-turbo",...}
 *    {"type":"system","subtype":"hook_started",...}
 *    {"type":"system","subtype":"hook_response",...}
 *
 * 2. assistant message (streamed):
 *    {"type":"assistant","message":{"id":"...","role":"assistant","model":"...","content":[{"type":"text","text":"..."}],"stop_reason":null,...},...}
 *
 * 3. tool use (inside assistant content):
 *    {"type":"assistant","message":{"content":[{"type":"text","text":"..."},{"type":"tool_use","id":"...","name":"ReadFile","input":{...}}],...}}
 *
 * 4. final result:
 *    {"type":"result","subtype":"success","result":"...","usage":{"input_tokens":N,"output_tokens":N},...}
 */

export interface ParsedSystemInit {
  type: 'system';
  subtype: 'init';
  session_id: string;
  model: string;
  tools?: string[];
  [key: string]: unknown;
}

export interface ParsedAssistantContent {
  type: 'text';
  text: string;
}

export interface ParsedToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ParsedAssistantMessage {
  type: 'assistant';
  message: {
    id: string;
    role: string;
    model?: string;
    content: Array<ParsedAssistantContent | ParsedToolUseBlock>;
    stop_reason?: string | null;
    usage?: { input_tokens: number; output_tokens: number };
  };
  session_id: string;
}

export interface ParsedResult {
  type: 'result';
  subtype: string;
  result?: string;
  is_error: boolean;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  session_id: string;
}

export interface ParsedRawUser {
  type: 'user';
  message?: unknown;
  session_id?: string;
}

export type ParsedLine = ParsedSystemInit | ParsedAssistantMessage | ParsedResult | ParsedToolResult | ParsedRawUser | null;

export interface ParsedToolResult {
  type: 'user';
  message?: {
    content: Array<{
      tool_use_id?: string;
      type: 'tool_result';
      content: string;
      is_error?: boolean;
    }>;
  };
  /** Matches the tool_use_id in assistant tool_use blocks */
  tool_use_result?: {
    tool_use_id: string;
    stdout: string;
    stderr: string;
    is_error: boolean;
    interrupted: boolean;
  };
  /** Diff/file tracking (hook-injected fields) */
  filePath?: string;
  content?: string;
  structuredPatch?: Array<{ oldStart: number; oldLines: number; newStart: number; newLines: number; lines: string[] }>;
  originalFile?: string | null;
  error?: string;
  session_id: string;
}


export function parseClaudeLine(line: string): ParsedLine {
  if (!line.trim()) return null;
  try {
    const obj = JSON.parse(line);
    return obj as ParsedLine;
  } catch {
    // Not valid JSON — treat as raw text
    return null;
  }
}

/**
 * Get token usage info from a parsed result line.
 */
export function extractTokenUsage(parsed: ParsedResult): { input: number; output: number } | null {
  if (parsed.type !== 'result' || !parsed.usage) return null;
  return {
    input: parsed.usage.input_tokens || 0,
    output: parsed.usage.output_tokens || 0,
  };
}

/**
 * Get model info from a system init line.
 */
export function extractModel(parsed: ParsedSystemInit): string | null {
  if (parsed.type !== 'system' || parsed.subtype !== 'init') return null;
  return parsed.model || null;
}
