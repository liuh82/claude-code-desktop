/**
 * Claude Direct API client — runs in Electron main process.
 * Connects to Anthropic Messages API via SSE streaming,
 * executes tools locally, and manages multi-turn conversation history.
 */

import { logInfo, logWarn, logError, logDebug } from './log-capture';
import { spawn } from 'child_process';
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
  {
    name: 'Edit',
    description: 'Make targeted edits to a file using search/replace blocks',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_path: { type: 'string' as const, description: 'Path to the file to edit' },
        old_string: { type: 'string' as const, description: 'Text to find in the file' },
        new_string: { type: 'string' as const, description: 'Replacement text' },
      },
      required: ['file_path', 'old_string', 'new_string'],
    },
  },
];

// ── System prompt ──

const CCDESK_SYSTEM_PROMPT = `你拥有以下工具可以操作用户的本地文件系统和执行命令：
- Read: 读取文件内容（绝对路径或相对路径）
- Write: 写入/创建文件
- Bash: 执行 shell 命令
- Grep: 在文件中搜索正则表达式
- Glob: 查找匹配 glob 模式的文件
- Edit: 通过搜索替换编辑文件

当你需要查看文件内容时，请使用 Read 工具。你一定可以读取用户的文件系统，不要说"无法读取"。当你需要执行命令时，请使用 Bash 工具。请主动使用这些工具来完成任务，不要直接回复说做不到。

## 可视化输出（Mermaid 图表）
当你的回复中需要描述架构、流程、时序、关系等内容时，使用 \`\`\`mermaid 代码块输出图表。

当用户用自然语言请求以下内容时，使用 mermaid 输出：
- "画个架构图"、"系统架构"、"模块关系" → graph TD
- "画个流程图"、"流程是什么"、"数据怎么走" → flowchart TD
- "时序图"、"调用顺序"、"交互流程" → sequenceDiagram
- "类图"、"类关系"、"继承关系" → classDiagram
- "ER图"、"数据模型"、"表关系" → erDiagram
- "甘特图"、"项目计划"、"时间线" → gantt
- "对比"、"方案对比"、"A和B哪个好" → quadrantChart 或 flowchart LR
- 任何要求用"图"、"图表"、"可视化"来展示的内容 → 选择合适的 mermaid 类型

### 简短指令
用户可以使用以下简短指令触发可视化图表生成：
- \`/class\` — 类关系图
- \`/seq\` 或 \`/sequence\` — 时序图
- \`/er\` — 实体关系图
- \`/gantt\` — 甘特图

### /seq — 时序图
使用 sequenceDiagram 表示组件间的调用顺序：
\`\`\`mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant B as 后端
    U->>F: 发送消息
    F->>B: API 请求
    B-->>F: 返回结果
    F-->>U: 显示回复
\`\`\`

### /class — 类图
使用 classDiagram 表示类/接口之间的关系：
\`\`\`mermaid
classDiagram
    class BaseComponent {
        +render()
        +setState()
    }
    class ChatMessage {
        +content: string
        +role: string
    }
    BaseComponent <|-- ChatMessage
\`\`\`

### /er — 实体关系图
使用 erDiagram 表示数据模型关系：
\`\`\`mermaid
erDiagram
    User ||--o{ Message : sends
    Message {
        string id
        string content
        string role
    }
\`\`\`

### /gantt — 甘特图
使用 gantt 表示项目计划和里程碑：
\`\`\`mermaid
gantt
    title 项目计划
    dateFormat  YYYY-MM-DD
    section 设计阶段
    需求分析     :a1, 2024-01-01, 10d
    UI 设计      :a2, after a1, 5d
    section 开发阶段
    前端开发     :b1, after a2, 15d
    后端开发     :b2, after a2, 15d
\`\`\`

### HTML 可视化幻灯片
当用户需要信息密集的可视化展示（对比分析、统计面板、KPI 概览、系统总览等）时，
使用 \`\`\`htmlslide 代码块输出完整的 HTML+CSS 页面。内容会直接在当前对话面板内以 Shadow DOM 渲染显示，不是在浏览器中打开。不要说"已在浏览器中打开"或类似的话。

**重要规则：**
- htmlslide 块内只写纯 HTML+CSS，**不要**在 htmlslide 内嵌套 markdown 语法（如 \`\`\` 代码块）
- 如果需要展示代码片段，直接用 <pre><code> 标签，并自行添加高亮颜色
- 不要在 htmlslide 内使用 mermaid 或其他代码块语法

输出格式示例：
\`\`\`htmlslide
<!DOCTYPE html>
<html><head><style>
body {
  margin: 0; padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #F0EAFF 0%, #E8F0FE 100%);
  min-height: 100vh;
}
.slide {
  max-width: 800px; width: 100%;
  background: white; border-radius: 16px;
  padding: 32px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}
h2 { color: #1e293b; margin: 0 0 16px 0; font-size: 24px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
.metric { background: #f8fafc; border-radius: 12px; padding: 20px; text-align: center; }
.metric .value { font-size: 36px; font-weight: 800; color: #6366f1; }
.metric .label { font-size: 14px; color: #64748b; margin-top: 4px; }
.metric .trend { font-size: 12px; color: #10b981; margin-top: 2px; }
</style></head>
<body>
<div class="slide">
  <h2>📊 项目概览</h2>
  <div class="grid">
    <div class="metric">
      <div class="value">92%</div>
      <div class="label">测试覆盖率</div>
      <div class="trend">↑ 3.2% 较上周</div>
    </div>
    <div class="metric">
      <div class="value">4.6</div>
      <div class="label">平均响应时间</div>
      <div class="trend">↓ 12% 优化</div>
    </div>
  </div>
</div>
</body></html>
\`\`\`

#### 主题配色
- **默认（Pastel）**：浅紫(#F0EAFF) / 浅蓝(#E8F0FE) / 浅绿(#ECFDF5) / 浅黄(#FEF9C3) / 浅粉(#FDF2F8) 渐变背景，白色卡片，#6366f1 强调色
- **商务（Business）**：深蓝(#1E3A5F) / 灰白(#F8FAFC) / 金色(#D4A574) 强调，更正式的排版
- **科技（Tech）**：深色(#0F172A) 背景，霓虹蓝(#3B82F6) / 霓虹紫(#8B5CF6) / 霓虹绿(#10B981) 发光效果

#### /slide 命令
- \`/slide\` — PPT 风格信息幻灯片
- \`/slide:business\` — 商务风格
- \`/slide:tech\` — 科技风格

#### 输出要求
1. HTML 包含内联 <style>，不引用外部资源
2. 系统字体栈：-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
3. Flexbox/Grid 布局
4. 颜色 HEX 格式
5. 信息丰富：大数字(28-36px font-weight 800)、百分比、趋势箭头、标签、进度条
6. 卡片圆角 12-16px + 柔和阴影
7. 顶部或侧边 4px 渐变色条装饰
8. \`/slide\` 命令后可跟用户需求描述
9. **精简 CSS**：避免冗余样式，合并重复选择器，CSS 部分控制在总输出的 30% 以内
10. **先完成再完美**：优先输出完整内容，不要过度设计单个元素的样式。宁可简洁完整，也不要精美但截断
11. **单页输出**：不要输出多页幻灯片，把所有内容放在一个 htmlslide 块中

#### 何时用 htmlslide vs mermaid
- **mermaid**：关系图、流程图、时序图、类图（节点+连线类图表）
- **htmlslide**：信息卡片、KPI 展示、对比分析、统计面板、项目概览

## 其他语法
- 图表可视化：使用 \`\`\`chart 代码块，内容为 ECharts JSON 配置。支持折线图、柱状图、饼图、散点图、雷达图等所有类型。
- 文件引用：用户消息中的 @path/to/file 表示引用项目文件。`;

// ── Sensitive paths that should never be written to (non-bypass) ──

const SENSITIVE_WRITE_PATHS = [
  '/etc', '/usr', '/bin', '/sbin', '/boot', '/dev', '/proc', '/sys',
  '/var/lib', '/var/log',
].map(p => path.resolve(p));

function getSensitiveHomePaths(): string[] {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (!home) return [];
  return [
    path.join(home, '.ssh'),
    path.join(home, '.gnupg'),
    path.join(home, '.aws'),
    path.join(home, '.gpg'),
    path.join(home, '.config', 'gnupg'),
    path.join(home, '.local', 'share', 'gnupg'),
  ].map(p => path.resolve(p));
}

function isSensitivePath(resolved: string): boolean {
  const normalized = path.resolve(resolved);
  for (const sp of SENSITIVE_WRITE_PATHS) {
    if (normalized === sp || normalized.startsWith(sp + path.sep)) return true;
  }
  for (const sp of getSensitiveHomePaths()) {
    if (normalized === sp || normalized.startsWith(sp + path.sep)) return true;
  }
  return false;
}

// ── Dangerous command patterns (log warning, don't block) ──

const DANGEROUS_COMMAND_PATTERNS = [
  /\brm\s+(-[rfRF]+\s+)?\/\s/,
  /\brm\s+(-[rfRF]+\s+)?\*$/,
  /\bsudo\b/,
  /\bmkfs\b/,
  /\bdd\s+.*of=\/dev\//,
  />\s*\/dev\/sd/,
  /\bchmod\s+(-R\s+)?777\s+\/\s/,
  /\bshutdown\b/,
  /\breboot\b/,
];

// ── API URL resolution ──

/**
 * Check if a base URL points to Anthropic's official API domain.
 */
function isAnthropicNativeDomain(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return host === 'api.anthropic.com';
  } catch {
    return false;
  }
}

/**
 * Smart URL resolution for Anthropic-compatible providers.
 * Handles various URL formats:
 * - `https://api.anthropic.com` → appends `/v1/messages`
 * - `https://open.bigmodel.cn/api/anthropic` → appends `/v1/messages`
 * - `https://proxy.com/v1/messages` → already complete, use as-is
 * - `https://openrouter.ai/api/v1` → appends `/messages`
 * - Trailing slashes are stripped before processing.
 */
export function resolveApiUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.endsWith('/messages')) return trimmed;
  if (trimmed.endsWith('/v1')) return `${trimmed}/messages`;
  return `${trimmed}/v1/messages`;
}

// ── Client class ──

export type PermissionMode = 'bypass' | 'auto' | 'ask';

// Tools considered safe — auto-executed in 'auto' mode
const SAFE_TOOLS = ['Read', 'Grep', 'Glob'];

export class ClaudeDirectClient {
  private config: DirectApiConfig;
  private messages: ApiMessage[] = [];
  private abortController: AbortController | null = null;
  private projectPath: string = '';
  private permissionMode: PermissionMode = 'auto';
  private permissionResolve: ((granted: boolean) => void) | null = null;
  private permissionTimer: ReturnType<typeof setTimeout> | null = null;

  /** Callbacks — set by main.ts after construction */
  onPermissionRequest: ((toolCall: { id: string; name: string; input: Record<string, unknown> }) => void) | null = null;
  onToolExecution: ((update: { id: string; name: string; input?: Record<string, unknown>; status: 'running' | 'completed' | 'error'; output?: string }) => void) | null = null;

  constructor(config: DirectApiConfig) {
    this.config = config;
  }

  setPermissionMode(mode: PermissionMode) {
    this.permissionMode = mode;
  }

  grantPermission(granted: boolean) {
    if (this.permissionTimer) {
      clearTimeout(this.permissionTimer);
      this.permissionTimer = null;
    }
    if (this.permissionResolve) {
      this.permissionResolve(granted);
      this.permissionResolve = null;
    }
  }

  /** Clean up pending permission on session close */
  cleanupPendingPermission() {
    if (this.permissionResolve) {
      this.permissionResolve(false);
      this.permissionResolve = null;
    }
    if (this.permissionTimer) {
      clearTimeout(this.permissionTimer);
      this.permissionTimer = null;
    }
  }

  setProjectPath(p: string) {
    this.projectPath = p;
  }

  stop() {
    this.abortController?.abort();
    this.abortController = null;
    this.cleanupPendingPermission();
  }

  reset() {
    this.messages = [];
    this.abortController = null;
    this.cleanupPendingPermission();
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
        const body: Record<string, unknown> = {
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          stream: true,
          system: CCDESK_SYSTEM_PROMPT,
          messages: this.messages,
          tools: TOOL_DEFINITIONS,
        };

        // Sanitize tool definitions for maximum API compatibility
        // (strip TypeScript artifacts, ensure clean JSON shapes)
        if (body.tools) {
          body.tools = (body.tools as any[]).map((t: any) => ({
            name: t.name,
            description: t.description,
            input_schema: {
              type: 'object',
              properties: t.input_schema?.properties,
              required: t.input_schema?.required,
            },
          }));
        }

        logDebug('DirectAPI', `[DirectAPI] Request body: tools=${(body.tools as any[])?.length || 0}, messages=${this.messages.length}`);

        // Build headers: always pass claude env as base, override auth
        const headers: Record<string, string> = {
          'content-type': 'application/json',
        };

        // Auth strategy: env var explicit config wins, then detect by domain
        const env = this.config.claudeEnv;
        const anthropicNative = isAnthropicNativeDomain(this.config.baseUrl);

        if (env.ANTHROPIC_API_KEY) {
          // Explicit API_KEY env → always use x-api-key (Anthropic native auth)
          headers['x-api-key'] = this.config.apiKey;
        } else if (env.ANTHROPIC_AUTH_TOKEN) {
          // AUTH_TOKEN without API_KEY → Bearer (third-party provider)
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        } else if (anthropicNative) {
          // No env hint + Anthropic domain → default to x-api-key
          headers['x-api-key'] = this.config.apiKey;
        } else {
          // No env hint + non-Anthropic domain → default to Bearer
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }
        // Always send anthropic-version — third-party providers may require it too
        headers['anthropic-version'] = '2023-06-01';

        // Pass through any additional headers from claude env
        // Only allow x- prefixed headers to prevent overriding sensitive headers like Host, Authorization
        if (env.ANTHROPIC_API_HEADERS) {
          try {
            const extra = JSON.parse(env.ANTHROPIC_API_HEADERS);
            for (const [key, value] of Object.entries(extra)) {
              if (typeof key === 'string' && key.startsWith('x-')) {
                headers[key] = String(value);
              }
            }
          } catch (e: any) {
            console.warn(`[DirectAPI] Failed to parse ANTHROPIC_API_HEADERS: ${e.message}`);
          }
        }

        const apiUrl = resolveApiUrl(this.config.baseUrl);
        logInfo('DirectAPI', `Round ${round}: POST ${apiUrl} model=${this.config.model} msgs=${this.messages.length}`);

        // Automatic timeout for fetch (5 minutes) — abort controller handles cancellation
        const fetchTimeout = setTimeout(() => {
          this.abortController?.abort();
          console.warn(`[DirectAPI] Fetch timeout (300s) for round ${round}`);
        }, 300_000);

        let response: Response;
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: this.abortController.signal,
          });
        } finally {
          clearTimeout(fetchTimeout);
        }

        if (!response.ok) {
          const errText = await response.text().catch(() => 'Unknown error');
          console.error(`[DirectAPI] HTTP ${response.status}: ${errText}`);
          onError(`API 错误 (${response.status}): ${errText}`);
          // Remove the last user message since it failed
          this.messages.pop();
          return;
        }

        logInfo('DirectAPI', `[DirectAPI] Stream started, status=${response.status}`);

        // Parse SSE stream
        const assistantContent = await this.parseSSEStream(response, onEvent);
        logInfo('DirectAPI', `[DirectAPI] Stream done, ${assistantContent.length} content blocks`);

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
          // Request permission before executing
          const granted = await this.requestPermission(toolBlock.id, toolBlock.name, toolBlock.input);
          if (!granted) {
            logWarn('DirectAPI', `[DirectAPI] Tool ${toolBlock.name}: granted=false (denied)`);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: 'Permission denied by user',
            });
            this.onToolExecution?.({ id: toolBlock.id, name: toolBlock.name, status: 'error', output: 'Permission denied by user' });
            continue;
          }

          // Notify renderer that tool is running
          this.onToolExecution?.({ id: toolBlock.id, name: toolBlock.name, input: toolBlock.input, status: 'running' });

          let result: string;
          try {
            result = await this.executeTool(toolBlock.name, toolBlock.input);
          } catch (err: any) {
            result = `Error: ${err.message}`;
            this.onToolExecution?.({ id: toolBlock.id, name: toolBlock.name, status: 'error', output: result });
            toolResults.push({ type: 'tool_result', tool_use_id: toolBlock.id, content: result });
            logError('DirectAPI', `[DirectAPI] Tool ${toolBlock.name}: granted=true, error=${err.message}`);
            continue;
          }

          // Notify renderer that tool completed
          this.onToolExecution?.({ id: toolBlock.id, name: toolBlock.name, status: 'completed', output: result });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: result,
          });
          logDebug('DirectAPI', `[DirectAPI] Tool ${toolBlock.name}: granted=true, result_len=${result.length}`);
        }

        // Add tool results as a new user message
        this.messages.push({
          role: 'user',
          content: toolResults,
        });

      } catch (err: any) {
        if (err.name === 'AbortError') {
          // User cancelled — remove the last user message to avoid stale state
          logWarn('DirectAPI', '[DirectAPI] Request aborted by user');
          if (this.messages.length > 0 && this.messages[this.messages.length - 1].role === 'user') {
            this.messages.pop();
          }
          return;
        }
        logError('DirectAPI', `[DirectAPI] Request failed: ${err.message}${err.stack ? '\n' + err.stack : ''}`);
        onError(`请求失败: ${err.message}`);
        return;
      }
    }

    onError('工具调用轮次超限（20 轮），已停止');
  }

  /**
   * Flush accumulated SSE data lines into a parsed event and process it.
   * Handles multi-line data fields per SSE spec (concatenated with newlines).
   */
  private flushSSEEvent(
    dataLines: string[],
    onEvent: (event: DirectSSEEvent) => void,
    contentBlocks: ApiContentBlock[],
    state: { currentTextIndex: number; currentToolIndex: number; currentToolId: string; currentToolName: string; currentToolJson: string },
    sync: (s: { currentTextIndex: number; currentToolIndex: number; currentToolId: string; currentToolName: string; currentToolJson: string }) => void,
  ) {
    const jsonStr = dataLines.join('');
    if (jsonStr === '[DONE]') return;

    let event: DirectSSEEvent;
    try {
      event = JSON.parse(jsonStr);
    } catch (e: any) {
      logError('SSE', `[DirectAPI SSE] JSON parse error: ${e.message}, raw: "${jsonStr.slice(0, 200)}"`);
      return;
    }

    logDebug('SSE', `[DirectAPI SSE] event type: ${event.type}`);
    onEvent(event);

    switch (event.type) {
      case 'message_start':
        if (event.message?.model) {
          logDebug('SSE', `[DirectAPI SSE] model: ${event.message.model}`);
        }
        break;

      case 'content_block_start': {
        const blockType = event.content_block?.type;
        if (blockType === 'tool_use') {
          logDebug('SSE', `[DirectAPI] Tool use detected: name=${event.content_block?.name}, id=${event.content_block?.id}`);
        }
        if (blockType === 'text') {
          state.currentTextIndex = contentBlocks.length;
          contentBlocks.push({ type: 'text', text: '' });
        } else if (blockType === 'tool_use') {
          state.currentToolIndex = contentBlocks.length;
          state.currentToolId = event.content_block?.id || `tool_${Date.now()}`;
          state.currentToolName = event.content_block?.name || 'unknown';
          state.currentToolJson = '';
          contentBlocks.push({
            type: 'tool_use',
            id: state.currentToolId,
            name: state.currentToolName,
            input: {},
          });
        }
        break;
      }

      case 'content_block_delta':
        if (event.delta?.type === 'text_delta' && event.delta.text && state.currentTextIndex >= 0) {
          const block = contentBlocks[state.currentTextIndex];
          if (block.type === 'text') {
            block.text += event.delta.text;
          }
        } else if (event.delta?.type === 'input_json_delta' && event.delta.partial_json) {
          state.currentToolJson += event.delta.partial_json;
        }
        break;

      case 'content_block_stop':
        // Finalize tool input JSON
        if (state.currentToolIndex >= 0 && state.currentToolJson) {
          const block = contentBlocks[state.currentToolIndex];
          if (block.type === 'tool_use') {
            try {
              block.input = JSON.parse(state.currentToolJson);
            } catch {
              block.input = { raw: state.currentToolJson };
            }
          }
        }
        // Reset tracking
        state.currentTextIndex = -1;
        state.currentToolIndex = -1;
        state.currentToolId = '';
        state.currentToolName = '';
        state.currentToolJson = '';
        break;

      case 'message_delta':
        // stop_reason is in event.delta, not event top-level
        const stopReason = (event as any).delta?.stop_reason || (event as any).stop_reason;
        if (stopReason) {
          if (stopReason === 'max_tokens') {
            logError('DirectAPI', `⚠️ Response truncated: stop_reason=max_tokens (hit ${this.config.maxTokens} token limit)`);
          } else if (stopReason === 'tool_use') {
            logInfo('DirectAPI', `stop_reason: tool_use (model wants to call tools)`);
          } else {
            logInfo('DirectAPI', `stop_reason: ${stopReason}`);
          }
        }
        if (event.usage) {
          logInfo('SSE', `usage: ${JSON.stringify(event.usage)}`);
        }
        break;

      case 'message_stop':
        logInfo('DirectAPI', `Stream complete: ${contentBlocks.length} blocks (${contentBlocks.map(b => b.type).join(', ')})`);
        break;

      case 'ping':
        break;

      case 'error':
        logError('SSE', `[DirectAPI SSE] Error event in stream: ${JSON.stringify(event)}`);
        break;

      default:
        logDebug('SSE', `[DirectAPI SSE] Unknown event type: ${event.type}`);
        break;
    }

    sync(state);
  }

  /**
   * Parse SSE stream from the API response.
   * Returns the accumulated assistant content blocks.
   */
  private async parseSSEStream(
    response: Response,
    onEvent: (event: DirectSSEEvent) => void,
  ): Promise<ApiContentBlock[]> {
    if (!response.body) {
      throw new Error('Response body is null — cannot read SSE stream');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let pendingDataLines: string[] = []; // Accumulate multi-line data fields per SSE event

    // Track current content blocks being built
    const contentBlocks: ApiContentBlock[] = [];
    let currentTextIndex = -1;
    let currentToolIndex = -1;
    let currentToolId = '';
    let currentToolName = '';
    let currentToolJson = '';

    try {
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
          if (!trimmed || trimmed.startsWith(':')) {
            // Empty line = end of current SSE event — flush accumulated data lines
            if (pendingDataLines.length > 0) {
              this.flushSSEEvent(
                pendingDataLines, onEvent, contentBlocks,
                { currentTextIndex, currentToolIndex, currentToolId, currentToolName, currentToolJson },
                (state) => {
                  currentTextIndex = state.currentTextIndex;
                  currentToolIndex = state.currentToolIndex;
                  currentToolId = state.currentToolId;
                  currentToolName = state.currentToolName;
                  currentToolJson = state.currentToolJson;
                },
              );
              pendingDataLines = [];
            }
            continue;
          }

          // Handle "event:" lines — some providers send explicit event type
          if (trimmed.startsWith('event:')) {
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            // SSE spec: multiple data: lines within one event are concatenated with newlines
            pendingDataLines.push(trimmed.slice(6));
            continue;
          }

          // Non-standard line — log but don't crash
          logDebug('SSE', `[DirectAPI SSE] Skipping non-data line: "${trimmed.slice(0, 100)}"`);
        }
      }
    } catch (e: any) {
      logError('DirectAPI', `[DirectAPI SSE] Stream read error: ${e.message}`);
      throw e; // Re-throw so sendMessage's catch handles it
    }

    // Process any remaining pending data in buffer
    if (pendingDataLines.length > 0) {
      this.flushSSEEvent(
        pendingDataLines, onEvent, contentBlocks,
        { currentTextIndex, currentToolIndex, currentToolId, currentToolName, currentToolJson },
        () => {},
      );
    }

    return contentBlocks;
  }

  /**
   * Check permission before executing a tool.
   * - bypass: always allow
   * - auto: safe tools auto-execute, dangerous tools prompt
   * - ask: all tools prompt
   * Returns false on timeout (60s).
   */
  private async requestPermission(
    toolCallId: string,
    name: string,
    input: Record<string, unknown>,
  ): Promise<boolean> {
    if (this.permissionMode === 'bypass') return true;
    if (this.permissionMode === 'auto' && SAFE_TOOLS.includes(name)) return true;

    // Send permission request to renderer
    if (this.onPermissionRequest) {
      this.onPermissionRequest({ id: toolCallId, name, input });
    }

    // Wait for user response with 60s timeout
    return new Promise<boolean>((resolve) => {
      this.permissionResolve = resolve;
      this.permissionTimer = setTimeout(() => {
        this.permissionResolve = null;
        this.permissionTimer = null;
        console.warn(`[DirectAPI] Permission timeout for ${name} — auto-denied`);
        resolve(false);
      }, 60_000);
    });
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
          // Block writes to sensitive system paths (unless bypass mode)
          if (isSensitivePath(resolved)) {
            if (this.permissionMode === 'bypass') {
              console.warn(`[DirectAPI] BYPASS MODE: writing to sensitive path: ${resolved}`);
            } else {
              return `Error: Write to sensitive path blocked: ${resolved}`;
            }
          } else if (this.projectPath && !resolved.startsWith(path.resolve(this.projectPath))) {
            console.warn(`[DirectAPI] Writing outside project directory: ${resolved}`);
          }
          // Ensure directory exists
          const dir = path.dirname(resolved);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(resolved, content, 'utf-8');
          return `Successfully wrote ${content.length} characters to ${resolved}`;
        }

        case 'Bash': {
          const command = String(input.command || '');
          const description = String(input.description || command);
          // Warn about dangerous commands without blocking them
          for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
            if (pattern.test(command)) {
              console.warn(`[DirectAPI] Potentially dangerous command detected: ${command.slice(0, 200)}`);
              break;
            }
          }
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
          return new Promise<string>((resolve) => {
            const args: string[] = ['-rn', '--color=never'];
            if (include) {
              args.push('--include', include);
            }
            args.push(pattern, searchPath);
            const proc = spawn('grep', args, {
              cwd: this.projectPath,
              timeout: 30_000,
              stdio: ['pipe', 'pipe', 'pipe'],
            });
            let stdout = '', stderr = '';
            proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
            proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
            proc.on('close', () => {
              // grep returns non-zero when no matches — that's OK
              resolve(stdout || '(no matches)');
            });
            proc.on('error', (err) => {
              resolve(`Error: ${err.message}`);
            });
          });
        }

        case 'Glob': {
          const pattern = String(input.pattern || '');
          const searchPath = String(input.path || this.projectPath);
          return new Promise<string>((resolve) => {
            // Use find with argument array to prevent shell injection
            const proc = spawn('find', [
              searchPath,
              '-path', path.join(searchPath, pattern),
              '-type', 'f',
            ], {
              cwd: this.projectPath,
              timeout: 10_000,
              stdio: ['pipe', 'pipe', 'pipe'],
            });
            let stdout = '';
            proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
            proc.on('close', () => {
              // Limit output to 200 results
              const lines = stdout.split('\n').filter(Boolean).slice(0, 200);
              resolve(lines.join('\n') || '(no matches)');
            });
            proc.on('error', (err) => {
              resolve(`Error: ${err.message}`);
            });
          });
        }

        case 'Edit': {
          const filePath = String(input.file_path || '');
          const oldString = String(input.old_string || '');
          const newString = String(input.new_string || '');
          const resolved = path.isAbsolute(filePath) ? filePath : path.join(this.projectPath, filePath);
          if (!fs.existsSync(resolved)) {
            return `Error: File not found: ${resolved}`;
          }
          const content = fs.readFileSync(resolved, 'utf-8');
          const idx = content.indexOf(oldString);
          if (idx === -1) {
            return `Error: old_string not found in ${resolved}`;
          }
          const edited = content.slice(0, idx) + newString + content.slice(idx + oldString.length);
          fs.writeFileSync(resolved, edited, 'utf-8');
          return `Successfully edited ${resolved}`;
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
   * Ensures retained messages follow the API's role alternation requirement.
   */
  private trimMessages() {
    const max = this.config.maxContextMessages;
    if (this.messages.length <= max * 2) return;

    // Keep the first user message (context) and last N pairs
    const firstMsg = this.messages[0];
    const recent = this.messages.slice(-(max * 2));

    // Merge consecutive same-role messages to satisfy API alternation requirement.
    // Content from dropped messages is concatenated into the kept message to
    // preserve information.
    const mergeContent = (a: ApiContentBlock[], b: ApiContentBlock[]): ApiContentBlock[] => {
      // If both have text blocks, merge them into one; otherwise keep separate
      const merged: ApiContentBlock[] = [...a];
      for (const block of b) {
        if (block.type === 'text' && merged.length > 0) {
          const lastBlock = merged[merged.length - 1];
          if (lastBlock.type === 'text') {
            merged[merged.length - 1] = { type: 'text', text: lastBlock.text + '\n' + block.text };
            continue;
          }
        }
        merged.push(block);
      }
      return merged;
    };

    // Check if a message contains tool_use or tool_result blocks — these must not
    // be merged with adjacent same-role messages to preserve tool context pairing.
    const hasToolBlocks = (content: ApiContentBlock[]): boolean =>
      content.some(b => b.type === 'tool_use' || b.type === 'tool_result');

    const filtered: ApiMessage[] = [firstMsg];
    let lastRole = firstMsg.role;
    for (const msg of recent) {
      if (msg.role !== lastRole) {
        filtered.push(msg);
        lastRole = msg.role;
      } else if (hasToolBlocks(msg.content) || hasToolBlocks(filtered[filtered.length - 1].content)) {
        // Don't merge — tool_use/tool_result blocks must stay intact to preserve
        // tool_use ↔ tool_result pairing required by the API.
        filtered.push(msg);
      } else {
        // Merge content into the last kept message instead of dropping
        const last = filtered[filtered.length - 1];
        last.content = mergeContent(last.content, msg.content);
      }
    }

    // Safety: ensure we don't end up with only one message or same-role at end
    if (filtered.length >= 2 && filtered[filtered.length - 1].role === filtered[filtered.length - 2].role) {
      // Remove the last message if it duplicates the previous role
      filtered.pop();
    }

    this.messages = filtered;
  }
}

// ── Config loader ──

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
    } catch (e: any) {
      console.warn(`[DirectAPI] Failed to read settings.json: ${e.message}`);
    }
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
    } catch (e: any) {
      console.warn(`[DirectAPI] Failed to read app settings: ${e.message}`);
    }
  }

  // API key: support all common env var names used by Claude Code and providers
  const apiKey = appSettings.directApiKey
    || claudeEnv.ANTHROPIC_API_KEY
    || claudeEnv.ANTHROPIC_AUTH_TOKEN
    || '';

  if (!apiKey) return null;

  // baseUrl priority: appSettings.directBaseUrl > env > default
  const baseUrl = appSettings.directBaseUrl
    || claudeEnv.ANTHROPIC_BASE_URL
    || 'https://api.anthropic.com';
  const model = claudeEnv.ANTHROPIC_MODEL || claudeEnv.ANTHROPIC_DEFAULT_SONNET_MODEL || appSettings.directModel || 'claude-sonnet-4-6';
  const maxTokens = appSettings.directMaxTokens || 32768;
  const maxContextMessages = appSettings.maxContextMessages || 20;

  logInfo('DirectAPI', `[DirectAPI] Config loaded: baseUrl=${baseUrl}, model=${model}, anthNative=${isAnthropicNativeDomain(baseUrl)}`);

  return { apiKey, baseUrl, model, maxTokens, maxContextMessages, claudeEnv };
}
