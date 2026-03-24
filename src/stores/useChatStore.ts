import { create } from 'zustand';
import type { ChatMessage, ToolCall, FileNode, DiffFile, TokenUsage, DbMessage, DbSession } from '@/types/chat';
import { claudeApi, isElectron } from '@/lib/claude-api';
import { parseClaudeLine, extractModel, isDirectApiLine, parseDirectApiLine } from '@/lib/claude-parser';
import type { ParsedAssistantMessage, ParsedResult, ParsedToolResult } from '@/lib/claude-parser';
import type { DirectSSEEvent } from '@/types/chat';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Mock data (browser only) ──

const MOCK_RESPONSES = [
  `我来帮你处理这个。先看一下当前的代码结构。

\`\`\`typescript
function greet(name: string): string {
  return \`你好, \${name}!\`;
}
\`\`\`

让我检查项目文件来了解上下文。`,
  `好的问题！分析如下：

**关键点：**
- 架构采用了清晰的关注点分离
- 状态管理使用 Zustand 保持简洁
- 组件结构模块化且可复用`,
];

const MOCK_TOOL_CALLS: ToolCall[][] = [
  [
    { id: 'tool-1', name: 'ReadFile', status: 'completed', input: { file_path: 'src/app/App.tsx' }, output: 'import { ... } from ...', duration: 120 },
  ],
  [],
];

const MOCK_FILE_TREE: FileNode[] = [
  {
    name: 'src', path: 'src', type: 'directory',
    children: [
      { name: 'app', path: 'src/app', type: 'directory', children: [
        { name: 'App.tsx', path: 'src/app/App.tsx', type: 'file', status: 'modified' },
      ] },
      { name: 'components', path: 'src/components', type: 'directory', children: [
        { name: 'Chat', path: 'src/components/Chat', type: 'directory', children: [
          { name: 'ChatView.tsx', path: 'src/components/Chat/ChatView.tsx', type: 'file' },
          { name: 'MessageBubble.tsx', path: 'src/components/Chat/MessageBubble.tsx', type: 'file' },
          { name: 'InputArea.tsx', path: 'src/components/Chat/InputArea.tsx', type: 'file' },
        ] },
        { name: 'Sidebar', path: 'src/components/Sidebar', type: 'directory', children: [
          { name: 'Sidebar.tsx', path: 'src/components/Sidebar/Sidebar.tsx', type: 'file' },
        ] },
        { name: 'ToolPanel', path: 'src/components/ToolPanel', type: 'directory', children: [
          { name: 'ToolPanel.tsx', path: 'src/components/ToolPanel/ToolPanel.tsx', type: 'file' },
        ] },
      ] },
      { name: 'stores', path: 'src/stores', type: 'directory', children: [
        { name: 'useChatStore.ts', path: 'src/stores/useChatStore.ts', type: 'file' },
      ] },
    ],
  },
];

// ── Per-pane state ──

interface PaneState {
  messages: ChatMessage[];
  isGenerating: boolean;
  tokenUsage: TokenUsage;
  currentModel: string;
  sessionId: string | null;
}

function emptyPaneState(): PaneState {
  return {
    messages: [],
    isGenerating: false,
    tokenUsage: { input: 0, output: 0 },
    currentModel: '',
    sessionId: null,
  };
}

// ── Global session state ──

let listenersStarted = false;
// Map paneId → per-pane stream state
const paneStreamingState = new Map<string, {
  assistantId: string | null;
  /** The message.id from the Claude stream to detect new assistant turns */
  streamMessageId: string | null;
  currentModel: string;
}>();
// Map paneId → Map<toolUseId, startTime> for duration calculation
const paneToolStartTimes = new Map<string, Map<string, number>>();
// Map sessionId → paneId (for IPC routing)
const sessionIdToPaneId = new Map<string, string>();

// Direct API streaming state per pane
const directStreamState = new Map<string, {
  assistantId: string | null;
  model: string;
  contentStarted: boolean;
  toolAccumulating: boolean;
  currentToolId: string;
  currentToolName: string;
}>();

// Global IPC cleanup
let cleanupFns: Array<() => void> = [];

function startListening() {
  if (listenersStarted) return;
  listenersStarted = true;
  stopListening();

  const unsubOutput = claudeApi.onClaudeOutput((line: string, sessionId: string) => {
    handleClaudeOutput(line, sessionId);
  });
  const unsubStderr = claudeApi.onClaudeStderr((data: string) => {
    console.warn('[CCDesk stderr]', data);
  });
  const unsubExit = claudeApi.onClaudeExit((_info) => {
    // Finalize ALL generating panes (defensive - in case sessionId mapping failed)
    const state = useChatStore.getState();
    for (const [paneId, pane] of state.panes) {
      if (pane.isGenerating) {
        finalizeAssistantForPane(paneId);
        useChatStore.setState((s) => {
          const next = new Map(s.panes);
          const p = next.get(paneId);
          if (p) next.set(paneId, { ...p, isGenerating: false });
          return { panes: next };
        });
      }
    }
  });
  const unsubError = claudeApi.onClaudeError((info) => {
    const paneId = sessionIdToPaneId.get(info.sessionId);
    if (!paneId) return;
    console.error('[CCDesk error]', info);
    finalizeAssistantForPane(paneId);
    useChatStore.setState((s) => {
      const next = new Map(s.panes);
      const pane = next.get(paneId);
      if (!pane) return s;
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `⚠️ 错误：${info.error}`,
        timestamp: Date.now(),
      };
      next.set(paneId, { ...pane, messages: [...pane.messages, errorMsg], isGenerating: false });
      return { panes: next };
    });
  });

  cleanupFns = [unsubOutput, unsubStderr, unsubExit, unsubError];
}

function stopListening() {
  cleanupFns.forEach(fn => fn());
  cleanupFns = [];
  listenersStarted = false;
}

function finalizeAssistantForPane(paneId: string) {
  const streaming = paneStreamingState.get(paneId);
  if (!streaming?.assistantId) return;

  useChatStore.setState((s) => {
    const pane = s.panes.get(paneId);
    if (!pane) return s;
    return {
      panes: new Map(s.panes).set(paneId, {
        ...pane,
        messages: pane.messages.map(m =>
          m.id === streaming.assistantId
            ? { ...m, isStreaming: false }
            : m
        ),
      }),
    };
  });
  paneStreamingState.set(paneId, { assistantId: null, streamMessageId: null, currentModel: streaming.currentModel });
  paneToolStartTimes.delete(paneId);
}

/**
 * Handle Direct API SSE events — true delta streaming.
 */
function handleDirectApiEvent(paneId: string, _sessionId: string, event: DirectSSEEvent) {
  // Initialize stream state if needed
  if (!directStreamState.has(paneId)) {
    directStreamState.set(paneId, {
      assistantId: null,
      model: '',
      contentStarted: false,
      toolAccumulating: false,
      currentToolId: '',
      currentToolName: '',
    });
  }
  const ds = directStreamState.get(paneId)!;

  switch (event.type) {
    case 'message_start': {
      // Extract model name
      if (event.message?.model) {
        ds.model = event.message.model;
        useChatStore.setState((s) => {
          const next = new Map(s.panes);
          const pane = next.get(paneId);
          if (pane) next.set(paneId, { ...pane, currentModel: event.message!.model });
          return { panes: next };
        });
      }
      break;
    }

    case 'content_block_start': {
      if (event.content_block?.type === 'text') {
        // New text block — create assistant message if first block
        if (!ds.contentStarted) {
          ds.contentStarted = true;
          const aid = generateId();
          ds.assistantId = aid;
          const assistantMsg: ChatMessage = {
            id: aid,
            role: 'assistant',
            content: '',
            toolCalls: [],
            timestamp: Date.now(),
            isStreaming: true,
            model: ds.model || undefined,
          };
          useChatStore.setState((s) => {
            const next = new Map(s.panes);
            const pane = next.get(paneId);
            if (!pane) return s;
            return { panes: new Map(s.panes).set(paneId, { ...pane, messages: [...pane.messages, assistantMsg] }) };
          });
        }
      } else if (event.content_block?.type === 'tool_use') {
        // Tool use block — create tool call with running status
        ds.toolAccumulating = true;
        ds.currentToolId = event.content_block.id || generateId();
        ds.currentToolName = event.content_block.name || 'unknown';
        const now = Date.now();
        const toolCall: ToolCall = {
          id: ds.currentToolId,
          name: ds.currentToolName,
          status: 'running',
          input: {},
          startTime: now,
        };

        // Record start time for duration
        if (!paneToolStartTimes.has(paneId)) {
          paneToolStartTimes.set(paneId, new Map());
        }
        paneToolStartTimes.get(paneId)!.set(ds.currentToolId, now);

        // Ensure assistant message exists
        const aid = ds.assistantId || generateId();
        if (!ds.assistantId) {
          ds.assistantId = aid;
          ds.contentStarted = true;
          const assistantMsg: ChatMessage = {
            id: aid,
            role: 'assistant',
            content: '',
            toolCalls: [],
            timestamp: Date.now(),
            isStreaming: true,
            model: ds.model || undefined,
          };
          useChatStore.setState((s) => {
            const next = new Map(s.panes);
            const pane = next.get(paneId);
            if (!pane) return s;
            return { panes: new Map(s.panes).set(paneId, { ...pane, messages: [...pane.messages, assistantMsg] }) };
          });
        }

        // Add tool call to assistant message
        useChatStore.setState((s) => {
          const next = new Map(s.panes);
          const pane = next.get(paneId);
          if (!pane) return s;
          return {
            panes: new Map(s.panes).set(paneId, {
              ...pane,
              messages: pane.messages.map(m => {
                if (m.id !== aid) return m;
                return { ...m, toolCalls: [...(m.toolCalls || []), toolCall] };
              }),
            }),
          };
        });
      }
      break;
    }

    case 'content_block_delta': {
      if (event.delta?.type === 'text_delta' && event.delta.text && ds.assistantId) {
        // True delta streaming — APPEND text
        useChatStore.setState((s) => {
          const next = new Map(s.panes);
          const pane = next.get(paneId);
          if (!pane || !pane.isGenerating) return s;
          return {
            panes: new Map(s.panes).set(paneId, {
              ...pane,
              messages: pane.messages.map(m =>
                m.id === ds.assistantId ? { ...m, content: m.content + event.delta!.text } : m
              ),
            }),
          };
        });
      }
      // input_json_delta is accumulated in main process, no action needed here
      break;
    }

    case 'content_block_stop': {
      // When tool_use block stops, the main process already has the full input.
      // The tool execution happens in main process, and when done, a new round starts.
      // We don't need to do anything special here — the main process sends a new message_start
      // for the continuation after tool results.
      ds.toolAccumulating = false;
      break;
    }

    case 'message_delta': {
      // Update token usage
      if (event.usage?.output_tokens) {
        useChatStore.setState((s) => {
          const next = new Map(s.panes);
          const pane = next.get(paneId);
          if (pane) {
            next.set(paneId, {
              ...pane,
              tokenUsage: {
                input: pane.tokenUsage.input,
                output: pane.tokenUsage.output + event.usage!.output_tokens,
              },
            });
          }
          return { panes: next };
        });
      }

      // If stop_reason is set, the conversation is done
      if (event.delta?.stop_reason && ds.assistantId) {
        finalizeDirectStream(paneId);
        useChatStore.setState((s) => {
          const next = new Map(s.panes);
          const pane = next.get(paneId);
          if (pane) next.set(paneId, { ...pane, isGenerating: false });
          return { panes: next };
        });
      }
      break;
    }

    case 'message_stop': {
      finalizeDirectStream(paneId);
      useChatStore.setState((s) => {
        const next = new Map(s.panes);
        const pane = next.get(paneId);
        if (pane) next.set(paneId, { ...pane, isGenerating: false });
        return { panes: next };
      });
      break;
    }

    case 'ping':
      break;
  }
}

function finalizeDirectStream(paneId: string) {
  const ds = directStreamState.get(paneId);
  if (!ds?.assistantId) return;

  useChatStore.setState((s) => {
    const pane = s.panes.get(paneId);
    if (!pane) return s;
    return {
      panes: new Map(s.panes).set(paneId, {
        ...pane,
        messages: pane.messages.map(m =>
          m.id === ds.assistantId ? { ...m, isStreaming: false } : m
        ),
      }),
    };
  });

  // Reset stream state for potential continuation (tool loop)
  ds.assistantId = null;
  ds.contentStarted = false;
  paneToolStartTimes.delete(paneId);
}

function handleClaudeOutput(line: string, sessionId: string) {
  const paneId = sessionIdToPaneId.get(sessionId);

  // Route Direct API events to dedicated handler
  if (isDirectApiLine(line)) {
    const parsed = parseDirectApiLine(line);
    if (parsed && paneId) {
      handleDirectApiEvent(paneId, sessionId, parsed.event);
    }
    return;
  }

  if (!paneId) return;
  if (!paneId) return;

  const parsed = parseClaudeLine(line);
  if (!parsed) return;

  // User/tool results — update tool call status + track diffs
  if (parsed.type === 'user') {
    const userParsed = parsed as ParsedToolResult;
    // 1. Update tool call completion status via tool_use_result
    const tr = userParsed.tool_use_result;
    if (tr && tr.tool_use_id) {
      const output = [tr.stdout, tr.stderr].filter(Boolean).join('\n') || undefined;
      const toolStartTimes = paneToolStartTimes.get(paneId);
      const startTime = toolStartTimes?.get(tr.tool_use_id);
      const duration = startTime ? Date.now() - startTime : undefined;

      useChatStore.setState((s) => {
        const next = new Map(s.panes);
        const pane = next.get(paneId);
        if (!pane) return s;
        return {
          panes: new Map(s.panes).set(paneId, {
            ...pane,
            messages: pane.messages.map(m => {
              if (!m.toolCalls) return m;
              const updatedCalls = m.toolCalls.map(tc =>
                tc.id === tr.tool_use_id
                  ? { ...tc, status: tr.is_error ? 'error' as const : 'completed' as const, output, duration }
                  : tc
              );
              return { ...m, toolCalls: updatedCalls };
            }),
          }),
        };
      });

      // Clean up start time
      toolStartTimes?.delete(tr.tool_use_id);
    }

    // 2. Track diffs (existing logic)
    if (userParsed.filePath) {
      const state = useChatStore.getState();
      const existingIdx = state.diffFiles.findIndex((d: any) => d.filePath === userParsed.filePath);
      const diffFile: any = { filePath: userParsed.filePath, status: 'modified' as const, hunks: [] };
      if (userParsed.structuredPatch && userParsed.structuredPatch.length > 0) {
        diffFile.hunks = userParsed.structuredPatch.map((hunk: any) => ({
          header: "@@ -" + hunk.oldStart + "," + hunk.oldLines + " +" + hunk.newStart + "," + hunk.newLines + " @@",
          lines: hunk.lines.map((l: string) => {
            if (l.startsWith("+")) return { type: "add", content: l.slice(1) };
            if (l.startsWith("-")) return { type: "delete", content: l.slice(1) };
            return { type: "context", content: l.slice(1) };
          }),
        }));
      }
      const newDiffs = [...state.diffFiles];
      if (existingIdx >= 0) newDiffs[existingIdx] = diffFile;
      else newDiffs.push(diffFile);
      useChatStore.setState({ diffFiles: newDiffs });
    }
    return;
  }

  // System init — extract model
  if (parsed.type === 'system') {
    const model = extractModel(parsed);
    if (model) {
      useChatStore.setState((s) => {
        const next = new Map(s.panes);
        const pane = next.get(paneId);
        if (pane) next.set(paneId, { ...pane, currentModel: model });
        return { panes: next };
      });
    }
    return;
  }

  // Assistant — handle text (replace, not append) and tool_use (track start time)
  if (parsed.type === 'assistant' && parsed.message) {
    const msg = parsed as ParsedAssistantMessage;

    if (msg.message.model) {
      useChatStore.setState((s) => {
        const next = new Map(s.panes);
        const pane = next.get(paneId);
        if (pane) next.set(paneId, { ...pane, currentModel: msg.message.model || pane.currentModel });
        return { panes: next };
      });
    }

    // Detect new assistant turn by message.id
    const streamMsgId = msg.message.id || null;
    const streaming = paneStreamingState.get(paneId);

    // New message.id means a new assistant turn — finalize previous
    if (streamMsgId && streaming && streaming.streamMessageId && streamMsgId !== streaming.streamMessageId) {
      if (streaming.assistantId) {
        // Mark previous assistant message as done streaming
        useChatStore.setState((s) => {
          const pane = s.panes.get(paneId);
          if (!pane) return s;
          return {
            panes: new Map(s.panes).set(paneId, {
              ...pane,
              messages: pane.messages.map(m =>
                m.id === streaming.assistantId ? { ...m, isStreaming: false } : m
              ),
            }),
          };
        });
      }
      // Reset for new turn
      paneToolStartTimes.delete(paneId);
    }

    // Update streamMessageId
    if (streamMsgId) {
      const current = paneStreamingState.get(paneId);
      paneStreamingState.set(paneId, {
        assistantId: current?.assistantId || null,
        streamMessageId: streamMsgId,
        currentModel: current?.currentModel || '',
      });
    }

    for (const block of msg.message.content) {
      if (block.type === 'text' && block.text) {
        useChatStore.setState((s) => {
          const next = new Map(s.panes);
          const pane = next.get(paneId);
          if (!pane || !pane.isGenerating) return s;

          const currentStreaming = paneStreamingState.get(paneId);
          const aid = currentStreaming?.assistantId || generateId();

          if (!currentStreaming?.assistantId) {
            // First block — create new assistant message, REPLACE content
            const assistantMsg: ChatMessage = {
              id: aid,
              role: 'assistant',
              content: block.text,
              toolCalls: [],
              timestamp: Date.now(),
              isStreaming: true,
              model: pane.currentModel || undefined,
            };
            next.set(paneId, { ...pane, messages: [...pane.messages, assistantMsg] });
            paneStreamingState.set(paneId, {
              assistantId: aid,
              streamMessageId: currentStreaming?.streamMessageId || streamMsgId,
              currentModel: pane.currentModel,
            });
          } else {
            // Same message — REPLACE content (stream gives complete text each time)
            next.set(paneId, {
              ...pane,
              messages: pane.messages.map(m =>
                m.id === aid ? { ...m, content: block.text } : m
              ),
            });
          }
          return { panes: next };
        });
      } else if (block.type === 'tool_use') {
        const now = Date.now();
        const toolCall: ToolCall = {
          id: block.id,
          name: block.name,
          status: 'running',
          input: block.input,
          startTime: now,
        };

        // Record start time for duration calc
        if (!paneToolStartTimes.has(paneId)) {
          paneToolStartTimes.set(paneId, new Map());
        }
        paneToolStartTimes.get(paneId)!.set(block.id, now);

        useChatStore.setState((s) => {
          const next = new Map(s.panes);
          const pane = next.get(paneId);
          if (!pane || !pane.isGenerating) return s;

          const currentStreaming = paneStreamingState.get(paneId);
          const aid = currentStreaming?.assistantId || generateId();

          if (!currentStreaming?.assistantId) {
            const assistantMsg: ChatMessage = {
              id: aid,
              role: 'assistant',
              content: '',
              toolCalls: [toolCall],
              timestamp: Date.now(),
              isStreaming: true,
              model: pane.currentModel || undefined,
            };
            next.set(paneId, { ...pane, messages: [...pane.messages, assistantMsg] });
            paneStreamingState.set(paneId, {
              assistantId: aid,
              streamMessageId: currentStreaming?.streamMessageId || streamMsgId,
              currentModel: pane.currentModel,
            });
          } else {
            // Add tool call if not already tracked (stream repeats existing tools)
            next.set(paneId, {
              ...pane,
              messages: pane.messages.map(m => {
                if (m.id !== aid) return m;
                const existing = m.toolCalls || [];
                const alreadyExists = existing.some(tc => tc.id === block.id);
                return {
                  ...m,
                  toolCalls: alreadyExists ? existing : [...existing, toolCall],
                };
              }),
            });
          }
          return { panes: next };
        });
      }
    }

    if (msg.message.stop_reason) {
      finalizeAssistantForPane(paneId);
    }
    return;
  }

  // Result — finalize
  if (parsed.type === 'result') {
    const result = parsed as ParsedResult;
    if (result.usage) {
      useChatStore.setState((s) => {
        const next = new Map(s.panes);
        const pane = next.get(paneId);
        if (pane && pane.isGenerating) {
          next.set(paneId, {
            ...pane,
            tokenUsage: {
              input: pane.tokenUsage.input + (result.usage.input_tokens || 0),
              output: pane.tokenUsage.output + (result.usage.output_tokens || 0),
            },
          });
        }
        return { panes: next };
      });
    }
    finalizeAssistantForPane(paneId);
    useChatStore.setState((s) => {
      const next = new Map(s.panes);
      const pane = next.get(paneId);
      if (pane) next.set(paneId, { ...pane, isGenerating: false });
      return { panes: next };
    });
    return;
  }
}

// ── Store ──

interface ChatState {
  panes: Map<string, PaneState>;
  fileTree: FileNode[];
  diffFiles: DiffFile[];
  projectPath: string;
  currentModel: string;

  setProjectPath: (path: string) => void;
  setCurrentModel: (model: string) => void;
  getMessages: (paneId: string) => ChatMessage[];
  isPaneGenerating: (paneId: string) => boolean;
  getPaneTokenUsage: (paneId: string) => TokenUsage;
  initPane: (paneId: string, projectPath: string, model?: string) => Promise<void>;
  sendMessage: (paneId: string, text: string) => Promise<void>;
  stopGeneration: (paneId: string) => void;
  clearPane: (paneId: string) => void;
  addSystemMessage: (paneId: string, content: string) => void;
  restoreMessages: (paneId: string, dbMessages: DbMessage[]) => void;
  getProjectSessions: (projectPath: string) => Promise<DbSession[]>;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  panes: new Map([['default', emptyPaneState()]]),
  fileTree: isElectron() ? [] : MOCK_FILE_TREE,
  currentModel: '',
  diffFiles: [],
  projectPath: '',

  setProjectPath: (path: string) => {
    set({ projectPath: path });
  },

  setCurrentModel: (model: string) => {
    set({ currentModel: model });
  },

  getMessages: (paneId: string) => {
    return get().panes.get(paneId)?.messages ?? [];
  },

  isPaneGenerating: (paneId: string) => {
    return get().panes.get(paneId)?.isGenerating ?? false;
  },

  getPaneTokenUsage: (paneId: string) => {
    return get().panes.get(paneId)?.tokenUsage ?? { input: 0, output: 0 };
  },

  initPane: async (paneId: string, projectPath: string, model?: string) => {
    // Close existing session if any
    const existing = get().panes.get(paneId);
    if (existing?.sessionId) {
      try { claudeApi.closeSession({ sessionId: existing.sessionId }); } catch {}
      sessionIdToPaneId.delete(existing.sessionId);
    }

    if (!isElectron()) {
      set((s) => ({
        panes: new Map(s.panes).set(paneId, emptyPaneState()),
        fileTree: MOCK_FILE_TREE,
        projectPath,
      }));
      return;
    }

    startListening();

    try {
      const { session_id } = await claudeApi.createSession({
        projectId: 'default',
        projectPath,
      });

      sessionIdToPaneId.set(session_id, paneId);

      await claudeApi.startSession({
        sessionId: session_id,
        projectPath,
        model,
      });

      // Try to restore messages from DB for this session
      try {
        const dbMessages = await claudeApi.loadMessages({ sessionId: session_id });
        if (dbMessages && dbMessages.length > 0) {
          const restoredMessages: ChatMessage[] = dbMessages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp).getTime(),
            isStreaming: false,
          }));
          set((s) => ({
            panes: new Map(s.panes).set(paneId, {
              ...emptyPaneState(),
              sessionId: session_id,
              currentModel: model || '',
              messages: restoredMessages,
            }),
            projectPath,
          }));
          return;
        }
      } catch {}

      // Load file tree
      const tree = await claudeApi.readDirectory({ dirPath: projectPath, maxDepth: 5 });

      set((s) => ({
        panes: new Map(s.panes).set(paneId, {
          ...emptyPaneState(),
          sessionId: session_id,
          currentModel: model || '',
        }),
        fileTree: tree as FileNode[],
        projectPath,
      }));
    } catch (err) {
      console.error('[CCDesk] Failed to init pane:', err);
      set((s) => ({
        panes: new Map(s.panes).set(paneId, emptyPaneState()),
        projectPath,
      }));
    }
  },

  sendMessage: async (paneId: string, text: string) => {
    const paneState = get().panes.get(paneId);
    if (!paneState) return;

    // Resolve @ file references — read file content and embed in message
    let resolvedText = text;
    if (isElectron()) {
      const { claudeApi } = await import('@/lib/claude-api');
      const atPattern = /@([\w\/.\-]+\.[\w]+)/g;
      let match;
      const replacements: Array<{ full: string; content: string }> = [];
      while ((match = atPattern.exec(text)) !== null) {
        const filePath = match[1];
        // Try as relative to project path first, then absolute
        const fullPath = get().projectPath + '/' + filePath;
        const result = await claudeApi.readFile({ filePath: fullPath });
        if (result.content !== null) {
          replacements.push({
            full: match[0],
            content: `@${filePath}\n\n---\n${result.content}\n---`,
          });
        }
      }
      for (const r of replacements) {
        resolvedText = resolvedText.replace(r.full, r.content);
      }
    }

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text, // Display original text (with @)
      timestamp: Date.now(),
    };

    set((s) => {
      const pane = s.panes.get(paneId);
      if (!pane) return s;
      return {
        panes: new Map(s.panes).set(paneId, {
          ...pane,
          messages: [...pane.messages, userMessage],
          isGenerating: true,
        }),
      };
    });

    if (isElectron()) {
      try {
        claudeApi.sendMessage({
          sessionId: paneState.sessionId || 'default',
          projectPath: get().projectPath,
          message: resolvedText,
        });
      } catch (err) {
        console.error('[CCDesk] sendMessage failed:', err);
        set((s) => {
          const pane = s.panes.get(paneId);
          if (!pane) return s;
          return { panes: new Map(s.panes).set(paneId, { ...pane, isGenerating: false }) };
        });
      }
    } else {
      mockTypingResponse(get, set, paneId);
    }
  },

  stopGeneration: (paneId: string) => {
    const paneState = get().panes.get(paneId);
    if (isElectron() && paneState?.sessionId) {
      claudeApi.stopGeneration({ sessionId: paneState.sessionId });
    }
    const streaming = paneStreamingState.get(paneId);
    const directDs = directStreamState.get(paneId);
    const activeAssistantId = streaming?.assistantId || directDs?.assistantId;
    if (activeAssistantId) {
      set((s) => {
        const pane = s.panes.get(paneId);
        if (!pane) return s;
        return {
          panes: new Map(s.panes).set(paneId, {
            ...pane,
            isGenerating: false,
            messages: pane.messages.map(m =>
              m.id === activeAssistantId ? { ...m, isStreaming: false } : m
            ),
          }),
        };
      });
      if (streaming) {
        paneStreamingState.set(paneId, { assistantId: null, streamMessageId: null, currentModel: streaming.currentModel });
      }
      if (directDs) {
        directDs.assistantId = null;
        directDs.contentStarted = false;
      }
      paneToolStartTimes.delete(paneId);
    } else {
      set((s) => {
        const pane = s.panes.get(paneId);
        if (!pane) return s;
        return { panes: new Map(s.panes).set(paneId, { ...pane, isGenerating: false }) };
      });
    }
  },

  addSystemMessage: (paneId: string, content: string) => {
    const pane = get().panes.get(paneId);
    if (!pane) return;
    const msg: ChatMessage = {
      id: `sys-${Date.now()}`,
      role: 'assistant',
      timestamp: Date.now(),
      content,
      isStreaming: false,
    };
    get().panes.set(paneId, { ...pane, messages: [...pane.messages, msg] });
  },

  clearPane: (paneId: string) => {
    const paneState = get().panes.get(paneId);
    if (isElectron() && paneState?.sessionId) {
      claudeApi.closeSession({ sessionId: paneState.sessionId });
      sessionIdToPaneId.delete(paneState.sessionId);
    }
    paneStreamingState.delete(paneId);
    directStreamState.delete(paneId);
    set((s) => ({
      panes: new Map(s.panes).set(paneId, emptyPaneState()),
    }));
  },

  restoreMessages: (paneId: string, dbMessages: DbMessage[]) => {
    const messages: ChatMessage[] = dbMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: new Date(m.timestamp).getTime(),
      isStreaming: false,
    }));
    set((s) => {
      const pane = s.panes.get(paneId);
      if (!pane) return s;
      return {
        panes: new Map(s.panes).set(paneId, { ...pane, messages }),
      };
    });
  },

  getProjectSessions: async (projectPath: string) => {
    if (!isElectron()) return [];
    return claudeApi.getProjectSessions({ projectPath });
  },
}));

// ── Mock typing animation ──

function mockTypingResponse(
  get: () => ChatState,
  set: (fn: (state: ChatState) => Partial<ChatState>) => void,
  paneId: string,
) {
  const responseIndex = Math.floor(Math.random() * MOCK_RESPONSES.length);
  const fullResponse = MOCK_RESPONSES[responseIndex];
  const toolCalls = MOCK_TOOL_CALLS[responseIndex];
  const assistantId = generateId();

  const assistantMessage: ChatMessage = {
    id: assistantId,
    role: 'assistant',
    content: '',
    toolCalls: [],
    timestamp: Date.now(),
    isStreaming: true,
  };

  setTimeout(() => {
    set((s) => {
      const pane = s.panes.get(paneId);
      if (!pane) return s;
      return { panes: new Map(s.panes).set(paneId, { ...pane, messages: [...pane.messages, assistantMessage] }) };
    });

    let charIndex = 0;
    const chunkSize = 3;
    const interval = setInterval(() => {
      if (!get().panes.get(paneId)?.isGenerating) {
        clearInterval(interval);
        finishMock(paneId, assistantId, toolCalls, set, get);
        return;
      }
      charIndex += chunkSize;
      if (charIndex >= fullResponse.length) {
        clearInterval(interval);
        finishMock(paneId, assistantId, toolCalls, set, get);
        return;
      }
      const partial = fullResponse.slice(0, charIndex);
      set((s) => {
        const pane = s.panes.get(paneId);
        if (!pane) return s;
        return {
          panes: new Map(s.panes).set(paneId, {
            ...pane,
            messages: pane.messages.map(m =>
              m.id === assistantId ? { ...m, content: partial } : m
            ),
          }),
        };
      });
    }, 15);
  }, 300);
}

function finishMock(
  paneId: string,
  assistantId: string,
  toolCalls: ToolCall[],
  set: (fn: (state: ChatState) => Partial<ChatState>) => void,
  _get: () => ChatState,
) {
  set((s) => {
    const pane = s.panes.get(paneId);
    if (!pane) return s;
    return {
      panes: new Map(s.panes).set(paneId, {
        ...pane,
        isGenerating: false,
        messages: pane.messages.map(m =>
          m.id === assistantId ? { ...m, isStreaming: false, toolCalls } : m
        ),
        tokenUsage: {
          input: pane.tokenUsage.input + Math.floor(Math.random() * 500 + 200),
          output: pane.tokenUsage.output + Math.floor(Math.random() * 1200 + 400),
        },
      }),
    };
  });
}
