import { create } from 'zustand';
import type { ChatMessage, ToolCall, FileNode, DiffFile, TokenUsage } from '@/types/chat';
import { claudeApi, isElectron } from '@/lib/claude-api';
import { parseClaudeLine, extractModel } from '@/lib/claude-parser';
import type { ParsedAssistantMessage, ParsedResult } from '@/lib/claude-parser';

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
  currentModel: string;
}>();
// Map sessionId → paneId (for IPC routing)
const sessionIdToPaneId = new Map<string, string>();

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
  paneStreamingState.set(paneId, { assistantId: null, currentModel: streaming.currentModel });
}

function handleClaudeOutput(line: string, sessionId: string) {
  const paneId = sessionIdToPaneId.get(sessionId);
  if (!paneId) return;

  const parsed = parseClaudeLine(line);
  if (!parsed) return;

  // User/tool results — track diffs only
  if (parsed.type === 'user') {
    const tr = (parsed as any).tool_use_result;
    if (tr && tr.filePath) {
      const state = useChatStore.getState();
      const existingIdx = state.diffFiles.findIndex((d: any) => d.filePath === tr.filePath);
      const status = tr.type === 'create' ? 'added' : tr.type === 'delete' ? 'deleted' : 'modified';
      const diffFile: any = { filePath: tr.filePath, status, hunks: [] };
      if (tr.structuredPatch && tr.structuredPatch.length > 0) {
        diffFile.hunks = tr.structuredPatch.map((hunk: any) => ({
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

  // Assistant — accumulate into streaming message
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

    for (const block of msg.message.content) {
      if (block.type === 'text' && block.text) {
        useChatStore.setState((s) => {
          const next = new Map(s.panes);
          const pane = next.get(paneId);
          if (!pane || !pane.isGenerating) return s;

          const streaming = paneStreamingState.get(paneId);
          const assistantId = streaming?.assistantId || generateId();
          const assistantMsg: ChatMessage = {
            id: assistantId,
            role: 'assistant',
            content: block.text,
            toolCalls: [],
            timestamp: Date.now(),
            isStreaming: true,
            model: pane.currentModel || undefined,
          };

          if (!streaming?.assistantId) {
            next.set(paneId, { ...pane, messages: [...pane.messages, assistantMsg] });
            paneStreamingState.set(paneId, { assistantId, currentModel: pane.currentModel });
          } else {
            next.set(paneId, {
              ...pane,
              messages: pane.messages.map(m =>
                m.id === assistantId ? { ...m, content: m.content + block.text } : m
              ),
            });
          }
          return { panes: next };
        });
      } else if (block.type === 'tool_use') {
        const toolCall: ToolCall = {
          id: block.id,
          name: block.name,
          status: 'running',
          input: block.input,
        };

        useChatStore.setState((s) => {
          const next = new Map(s.panes);
          const pane = next.get(paneId);
          if (!pane || !pane.isGenerating) return s;

          const streaming = paneStreamingState.get(paneId);
          const assistantId = streaming?.assistantId || generateId();

          if (!streaming?.assistantId) {
            const assistantMsg: ChatMessage = {
              id: assistantId,
              role: 'assistant',
              content: '',
              toolCalls: [toolCall],
              timestamp: Date.now(),
              isStreaming: true,
              model: pane.currentModel || undefined,
            };
            next.set(paneId, { ...pane, messages: [...pane.messages, assistantMsg] });
            paneStreamingState.set(paneId, { assistantId, currentModel: pane.currentModel });
          } else {
            next.set(paneId, {
              ...pane,
              messages: pane.messages.map(m =>
                m.id === assistantId
                  ? { ...m, toolCalls: [...(m.toolCalls || []), toolCall] }
                  : m
              ),
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
  sendMessage: (paneId: string, text: string) => void;
  stopGeneration: (paneId: string) => void;
  clearPane: (paneId: string) => void;
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

  sendMessage: (paneId: string, text: string) => {
    const paneState = get().panes.get(paneId);
    if (!paneState) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
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
          message: text,
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
    if (streaming?.assistantId) {
      set((s) => {
        const pane = s.panes.get(paneId);
        if (!pane) return s;
        return {
          panes: new Map(s.panes).set(paneId, {
            ...pane,
            isGenerating: false,
            messages: pane.messages.map(m =>
              m.id === streaming.assistantId ? { ...m, isStreaming: false } : m
            ),
          }),
        };
      });
      paneStreamingState.set(paneId, { assistantId: null, currentModel: streaming.currentModel });
    } else {
      set((s) => {
        const pane = s.panes.get(paneId);
        if (!pane) return s;
        return { panes: new Map(s.panes).set(paneId, { ...pane, isGenerating: false }) };
      });
    }
  },

  clearPane: (paneId: string) => {
    const paneState = get().panes.get(paneId);
    if (isElectron() && paneState?.sessionId) {
      claudeApi.closeSession({ sessionId: paneState.sessionId });
      sessionIdToPaneId.delete(paneState.sessionId);
    }
    paneStreamingState.delete(paneId);
    set((s) => ({
      panes: new Map(s.panes).set(paneId, emptyPaneState()),
    }));
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
