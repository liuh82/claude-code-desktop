/**
 * Parse Claude CLI stream-json output.
 */

export interface ParsedTextContent {
  type: 'text';
  text: string;
}

export interface ParsedToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ParsedMessage {
  type: 'assistant' | 'user' | 'result' | 'system';
  message?: {
    role: string;
    content: Array<ParsedTextContent | ParsedToolUse>;
    model?: string;
    stop_reason?: string;
  };
  result?: string;
  subtype?: string;
}

export function parseClaudeLine(line: string): ParsedMessage | null {
  if (!line.trim()) return null;
  try {
    return JSON.parse(line) as ParsedMessage;
  } catch {
    return { type: 'assistant', result: line };
  }
}

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls: {
    id: string;
    name: string;
    input: Record<string, unknown>;
    result?: string;
    status: 'running' | 'completed' | 'error';
  }[];
  model?: string;
  timestamp: number;
}

let msgCounter = 0;

export function streamJsonToChatMessages(lines: ParsedMessage[]): { messages: ChatMsg[]; pending: boolean } {
  const messages: ChatMsg[] = [];
  let pending = false;
  let currentAssistant: ChatMsg | null = null;

  for (const parsed of lines) {
    if (parsed.type === 'assistant' && parsed.message) {
      if (!currentAssistant) {
        currentAssistant = {
          id: `msg-${++msgCounter}`,
          role: 'assistant',
          content: '',
          toolCalls: [],
          model: parsed.message.model,
          timestamp: Date.now(),
        };
      }
      for (const block of parsed.message.content) {
        if (block.type === 'text') {
          currentAssistant.content += block.text;
        } else if (block.type === 'tool_use') {
          currentAssistant.toolCalls.push({
            id: block.id,
            name: block.name,
            input: block.input,
            status: 'running',
          });
        }
      }
      pending = !parsed.message.stop_reason;
    } else if (parsed.type === 'result') {
      if (currentAssistant) {
        if (parsed.result) currentAssistant.content += (currentAssistant.content ? '\n\n' : '') + parsed.result;
        currentAssistant.toolCalls.forEach(tc => { if (tc.status === 'running') tc.status = 'completed'; });
        messages.push(currentAssistant);
        currentAssistant = null;
      }
    }
  }

  if (currentAssistant) {
    messages.push(currentAssistant);
    pending = true;
  }

  return { messages, pending };
}
