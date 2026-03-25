/**
 * Claude Direct API client — runs in Electron main process.
 * Connects to Anthropic Messages API via SSE streaming,
 * executes tools locally, and manages multi-turn conversation history.
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ── Types ──

interface DirectApiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  maxContextMessages: number;
  /** All claude env vars to pass through to API calls */
  claudeEnv: Record<string, string>;
}

interface DirectSSEEvent {
  type: string;
  message?: { id: string; model: string; usage: { input_tokens: number } };
  index?: number;
  content_block?: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };
  delta?: { type: string; text?: string; partial_json?: string };
  stop_reason?: string | null;
  usage?: { output_tokens: number };
}

interface ApiMessage {
  role: 'user' | 'assistant';
  content: Array<ApiContentBlock>;
}

type ApiContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

// ── Tool definitions for Anthropic API ──

const TOOL_DEFINITIONS = [
  {
    name: 'Read',
    description: 'Read file contents from disk',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_path: { type: 'string' as const, description: 'Absolute or relative file path to read' },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'Write',
    description: 'Write content to a file, creating it if it does not exist',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_path: { type: 'string' as const, description: 'Path to the file to write' },
        content: { type: 'string' as const, description: 'Content to write to the file' },
      },
      required: ['file_path', 'content'],
    },
  },
  {
    name: 'Bash',
    description: 'Execute a shell command and return output',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: { type: 'string' as const, description: 'Shell command to execute' },
        description: { type: 'string' as const, description: 'Brief description of what the command does' },
      },
      required: ['command'],
    },
  },
  {
    name: 'Grep',
    description: 'Search for a pattern in files using ripgrep',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string' as const, description: 'Regex pattern to search for' },
        path: { type: 'string' as const, description: 'Directory to search in' },
        include: { type: 'string' as const, description: 'File glob filter (e.g. "*.ts")' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'Glob',
    description: 'Find files matching a glob pattern',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string' as const, description: 'Glob pattern (e.g. "**/*.tsx")' },
        path: { type: 'string' as const, description: 'Base directory to search in' },
      },
      required: ['pattern'],
    },
  },
];

// ── System prompt ──

const CCDESK_SYSTEM_PROMPT = `CCDesk 桌面客户端支持以下扩展语法，请在需要可视化数据时使用：
1. 图表可视化：使用 \`\`\`chart 代码块，内容为 ECharts JSON 配置。支持折线图、柱状图、饼图、散点图、雷达图等所有类型。
2. 文件引用：用户消息中的 @path/to/file 表示引用项目文件。`;

// ── Client class ──

export class ClaudeDirectClient {
  private config: DirectApiConfig;
  private messages: ApiMessage[] = [];
  private abortController: AbortController | null = null;
  private projectPath: string = '';

  constructor(config: DirectApiConfig) {
    this.config = config;
  }

  setProjectPath(p: string) {
    this.projectPath = p;
  }

  stop() {
    this.abortController?.abort();
    this.abortController = null;
  }

  reset() {
    this.messages = [];
    this.abortController = null;
  }

  getMessages(): ApiMessage[] {
    return this.messages;
  }

  /**
   * Send a user message and stream the response.
   * Handles tool-use loops automatically.
   */
  async sendMessage(
    sessionId: string,
    message: string,
    projectPath: string,
    onEvent: (event: DirectSSEEvent) => void,
    onError: (error: string) => void,
  ): Promise<void> {
    this.projectPath = projectPath;
    this.abortController = new AbortController();

    // Add user message to history
    this.messages.push({
      role: 'user',
      content: [{ type: 'text', text: message }],
    });

    // Tool-use loop: keep calling API until no tool_use blocks remain
    const maxToolRounds = 20;
    let round = 0;

    while (round < maxToolRounds) {
      round++;

      // Trim context if too long
      this.trimMessages();

      try {
        const hasTools = this.messages.some(m =>
          m.content.some(b => b.type === 'tool_result')
        );

        const body: Record<string, unknown> = {
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          stream: true,
          system: CCDESK_SYSTEM_PROMPT,
          messages: this.messages,
        };

        // Only include tools when there are tool_result messages (otherwise they confuse the model)
        if (hasTools || round > 1) {
          body.tools = TOOL_DEFINITIONS;
        }

        // Build headers: always pass claude env as base, override auth
        const headers: Record<string, string> = {
          'content-type': 'application/json',
        };

        // Claude Code uses x-api-key for Anthropic, Bearer for others
        // Detect by checking if claude config has AUTH_TOKEN (third-party) vs API_KEY (Anthropic native)
        const env = this.config.claudeEnv;
        if (env.ANTHROPIC_AUTH_TOKEN && !env.ANTHROPIC_API_KEY) {
          // Third-party provider (e.g. 智谱, OpenRouter, etc.)
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        } else {
          // Anthropic native or Anthropic-compatible
          headers['x-api-key'] = this.config.apiKey;
          headers['anthropic-version'] = '2023-06-01';
        }

        // Pass through any additional headers from claude env
        if (env.ANTHROPIC_API_HEADERS) {
          try {
            const extra = JSON.parse(env.ANTHROPIC_API_HEADERS);
            Object.assign(headers, extra);
          } catch {}
        }

        const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: this.abortController.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => 'Unknown error');
          onError(`API 错误 (${response.status}): ${errText}`);
          // Remove the last user message since it failed
          this.messages.pop();
          return;
        }

        // Parse SSE stream
        const assistantContent = await this.parseSSEStream(response, onEvent);

        // If no content, we're done
        if (!assistantContent || assistantContent.length === 0) {
          return;
        }

        // Check if assistant wants to use tools
        const toolUseBlocks = assistantContent.filter(
          (b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
            b.type === 'tool_use'
        );

        if (toolUseBlocks.length === 0) {
          // No tool calls — conversation turn is done
          return;
        }

        // Add assistant message (with tool_use blocks) to history
        this.messages.push({
          role: 'assistant',
          content: assistantContent,
        });

        // Execute each tool and collect results
        const toolResults: ApiContentBlock[] = [];
        for (const toolBlock of toolUseBlocks) {
          const result = await this.executeTool(
            toolBlock.name,
            toolBlock.input,
          );
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: result,
          });
        }

        // Add tool results as a new user message
        this.messages.push({
          role: 'user',
          content: toolResults,
        });

      } catch (err: any) {
        if (err.name === 'AbortError') {
          // User cancelled — don't treat as error
          return;
        }
        onError(`请求失败: ${err.message}`);
        return;
      }
    }

    onError('工具调用轮次超限（20 轮），已停止');
  }

  /**
   * Parse SSE stream from the API response.
   * Returns the accumulated assistant content blocks.
   */
  private async parseSSEStream(
    response: Response,
    onEvent: (event: DirectSSEEvent) => void,
  ): Promise<ApiContentBlock[]> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Track current content blocks being built
    const contentBlocks: ApiContentBlock[] = [];
    let currentTextIndex = -1;
    let currentToolIndex = -1;
    let currentToolId = '';
    let currentToolName = '';
    let currentToolJson = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE format: "event: ...\ndata: ...\n\n"
      // But Anthropic uses data-only lines (event is inline in JSON)
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue; // skip comments/empty

        if (!trimmed.startsWith('data: ')) continue;

        const jsonStr = trimmed.slice(6);
        if (jsonStr === '[DONE]') continue;

        let event: DirectSSEEvent;
        try {
          event = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        // Forward every event to the renderer
        onEvent(event);

        switch (event.type) {
          case 'message_start':
            // Extract model from message_start
            if (event.message?.model) {
              // Already forwarded — renderer will extract model
            }
            break;

          case 'content_block_start':
            if (event.content_block?.type === 'text') {
              currentTextIndex = contentBlocks.length;
              contentBlocks.push({ type: 'text', text: '' });
            } else if (event.content_block?.type === 'tool_use') {
              currentToolIndex = contentBlocks.length;
              currentToolId = event.content_block.id || `tool_${Date.now()}`;
              currentToolName = event.content_block.name || 'unknown';
              currentToolJson = '';
              contentBlocks.push({
                type: 'tool_use',
                id: currentToolId,
                name: currentToolName,
                input: {},
              });
            }
            break;

          case 'content_block_delta':
            if (event.delta?.type === 'text_delta' && event.delta.text && currentTextIndex >= 0) {
              const block = contentBlocks[currentTextIndex];
              if (block.type === 'text') {
                block.text += event.delta.text;
              }
            } else if (event.delta?.type === 'input_json_delta' && event.delta.partial_json) {
              currentToolJson += event.delta.partial_json;
            }
            break;

          case 'content_block_stop':
            // Finalize tool input JSON
            if (currentToolIndex >= 0 && currentToolJson) {
              const block = contentBlocks[currentToolIndex];
              if (block.type === 'tool_use') {
                try {
                  block.input = JSON.parse(currentToolJson);
                } catch {
                  block.input = { raw: currentToolJson };
                }
              }
            }
            // Reset tracking
            currentTextIndex = -1;
            currentToolIndex = -1;
            currentToolId = '';
            currentToolName = '';
            currentToolJson = '';
            break;

          case 'message_stop':
            // Stream complete
            break;
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim().startsWith('data: ')) {
      const jsonStr = buffer.trim().slice(6);
      try {
        const event = JSON.parse(jsonStr);
        onEvent(event);
      } catch {}
    }

    return contentBlocks;
  }

  /**
   * Execute a tool locally and return the result string.
   */
  private async executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    try {
      switch (name) {
        case 'Read': {
          const filePath = String(input.file_path || '');
          const resolved = path.isAbsolute(filePath) ? filePath : path.join(this.projectPath, filePath);
          if (!fs.existsSync(resolved)) {
            return `Error: File not found: ${resolved}`;
          }
          const content = fs.readFileSync(resolved, 'utf-8');
          return content.slice(0, 100_000); // Cap at 100KB
        }

        case 'Write': {
          const filePath = String(input.file_path || '');
          const content = String(input.content || '');
          const resolved = path.isAbsolute(filePath) ? filePath : path.join(this.projectPath, filePath);
          // Ensure directory exists
          const dir = path.dirname(resolved);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(resolved, content, 'utf-8');
          return `Successfully wrote ${content.length} characters to ${resolved}`;
        }

        case 'Bash': {
          const command = String(input.command || '');
          const description = String(input.description || command);
          return new Promise<string>((resolve) => {
            const timeout = 120_000;
            const proc = spawn('bash', ['-c', command], {
              cwd: this.projectPath,
              env: { ...process.env },
              timeout,
              stdio: ['pipe', 'pipe', 'pipe'],
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
            proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

            const timer = setTimeout(() => {
              proc.kill('SIGTERM');
              resolve(`Command timed out after ${timeout / 1000}s\n\nstdout:\n${stdout}\n\nstderr:\n${stderr}`);
            }, timeout);

            proc.on('close', (code) => {
              clearTimeout(timer);
              const output = [stdout, stderr].filter(Boolean).join('\n');
              const exitInfo = code !== null && code !== 0 ? `\nExit code: ${code}` : '';
              resolve(output + exitInfo || '(no output)');
            });

            proc.on('error', (err) => {
              clearTimeout(timer);
              resolve(`Error executing command: ${err.message}`);
            });
          });
        }

        case 'Grep': {
          const pattern = String(input.pattern || '');
          const searchPath = String(input.path || this.projectPath);
          const include = String(input.include || '');
          try {
            const args = ['-rn', '--color=never', pattern, searchPath];
            if (include) {
              args.splice(1, 0, '--include', include);
            }
            const result = execSync(`grep ${args.join(' ')}`, {
              cwd: this.projectPath,
              encoding: 'utf-8',
              timeout: 30_000,
              maxBuffer: 1024 * 1024,
            });
            return result || '(no matches)';
          } catch (err: any) {
            // grep returns non-zero when no matches — that's OK
            return err.stdout || '(no matches)';
          }
        }

        case 'Glob': {
          const pattern = String(input.pattern || '');
          const searchPath = String(input.path || this.projectPath);
          try {
            // Use find as a portable glob alternative
            // Convert simple glob to find expression
            const result = execSync(
              `find "${searchPath}" -path "${searchPath}/${pattern}" -type f 2>/dev/null | head -200`,
              {
                cwd: this.projectPath,
                encoding: 'utf-8',
                timeout: 10_000,
                maxBuffer: 1024 * 512,
              },
            );
            return result.trim() || '(no matches)';
          } catch {
            return '(no matches)';
          }
        }

        default:
          return `Unknown tool: ${name}`;
      }
    } catch (err: any) {
      return `Error executing ${name}: ${err.message}`;
    }
  }

  /**
   * Trim conversation history to maxContextMessages pairs (user+assistant).
   */
  private trimMessages() {
    const max = this.config.maxContextMessages;
    if (this.messages.length <= max * 2) return;

    // Keep the first user message (context) and last N pairs
    const firstMsg = this.messages[0];
    const recent = this.messages.slice(-(max * 2));
    this.messages = [firstMsg, ...recent];
  }
}

// ── Config loader ──

/**
 * Load API config from ~/.claude/settings.json env vars + process.env fallback.
 */
/**
 * Load API config from ~/.claude/settings.json env vars + process.env.
 * Passes through ALL claude env vars for maximum compatibility with any provider.
 */
export function loadDirectApiConfig(db?: any): DirectApiConfig | null {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (!home) return null;

  // Read ALL env vars from Claude settings
  let claudeEnv: Record<string, string> = {};
  const settingsPath = path.join(home, '.claude', 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      claudeEnv = (data.env || {}) as Record<string, string>;
    } catch {}
  }

  // Merge process.env overrides
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('ANTHROPIC_') && process.env[key]) {
      claudeEnv[key] = process.env[key] as string;
    }
  }

  // App-level settings override
  let appSettings: Record<string, any> = {};
  if (db) {
    try {
      const row = db.prepare("SELECT value FROM app_settings WHERE key = 'settings' LIMIT 1").get();
      if (row?.value) {
        appSettings = JSON.parse(row.value);
      }
    } catch {}
  }

  // API key: support all common env var names used by Claude Code and providers
  const apiKey = appSettings.directApiKey
    || claudeEnv.ANTHROPIC_API_KEY
    || claudeEnv.ANTHROPIC_AUTH_TOKEN
    || '';

  if (!apiKey) return null;

  const baseUrl = claudeEnv.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
  const model = claudeEnv.ANTHROPIC_MODEL || claudeEnv.ANTHROPIC_DEFAULT_SONNET_MODEL || appSettings.directModel || 'claude-sonnet-4-6';
  const maxTokens = appSettings.directMaxTokens || 8192;
  const maxContextMessages = appSettings.maxContextMessages || 20;

  return { apiKey, baseUrl, model, maxTokens, maxContextMessages, claudeEnv };
}
