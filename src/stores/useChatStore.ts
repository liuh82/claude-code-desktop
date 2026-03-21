import { create } from 'zustand';
import type { ChatMessage, ToolCall, FileNode, DiffFile, TokenUsage } from '@/types/chat';
import { claudeApi, isElectron } from '@/lib/claude-api';
import { parseClaudeLine } from '@/lib/claude-parser';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Mock data (used in browser only) ──

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

// ── Real Claude session state ──

let activeSessionId: string | null = null;
let cleanupFns: Array<() => void> = [];
let currentAssistantId: string | null = null;

function startListening() {
  stopListening();
  const unsubOutput = claudeApi.onClaudeOutput((line: string) => {
    handleClaudeOutput(line);
  });
  const unsubStderr = claudeApi.onClaudeStderr((data: string) => {
    console.warn('[CCDesk stderr]', data);
  });
  const unsubExit = claudeApi.onClaudeExit((info) => {
    const state = useChatStore.getState();
    if (state.isGenerating) {
      useChatStore.setState({ isGenerating: false });
    }
    if (info.sessionId === activeSessionId) {
      activeSessionId = null;
      currentAssistantId = null;
    }
  });
  const unsubError = claudeApi.onClaudeError((info) => {
    console.error('[CCDesk error]', info);
    useChatStore.setState({ isGenerating: false });
  });
  cleanupFns = [unsubOutput, unsubStderr, unsubExit, unsubError];
}

function stopListening() {
  cleanupFns.forEach(fn => fn());
  cleanupFns = [];
}

function handleClaudeOutput(line: string) {
  const parsed = parseClaudeLine(line);
  if (!parsed) return;

  const state = useChatStore.getState();

  // Handle assistant text messages
  if (parsed.type === 'assistant' && parsed.message) {
    for (const block of parsed.message.content) {
      if (block.type === 'text') {
        if (!currentAssistantId) {
          currentAssistantId = generateId();
          const assistantMsg: ChatMessage = {
            id: currentAssistantId,
            role: 'assistant',
            content: block.text,
            toolCalls: [],
            timestamp: Date.now(),
            isStreaming: true,
            model: parsed.message.model,
          };
          useChatStore.setState({
            messages: [...state.messages, assistantMsg],
          });
        } else {
          useChatStore.setState({
            messages: state.messages.map(m =>
              m.id === currentAssistantId
                ? { ...m, content: m.content + block.text }
                : m
            ),
          });
        }
      } else if (block.type === 'tool_use') {
        const toolCall: ToolCall = {
          id: block.id,
          name: block.name,
          status: 'running',
          input: block.input,
        };

        if (!currentAssistantId) {
          currentAssistantId = generateId();
          const assistantMsg: ChatMessage = {
            id: currentAssistantId,
            role: 'assistant',
            content: '',
            toolCalls: [toolCall],
            timestamp: Date.now(),
            isStreaming: true,
            model: parsed.message.model,
          };
          useChatStore.setState({
            messages: [...state.messages, assistantMsg],
          });
        } else {
          useChatStore.setState({
            messages: state.messages.map(m =>
              m.id === currentAssistantId
                ? { ...m, toolCalls: [...(m.toolCalls || []), toolCall] }
                : m
            ),
          });
        }
      }
    }

    // If stop_reason present, finalize
    if (parsed.message.stop_reason) {
      finalizeAssistantMessage();
    }
  } else if (parsed.type === 'result') {
    finalizeAssistantMessage();
  }
}

function finalizeAssistantMessage() {
  if (!currentAssistantId) return;
  const state = useChatStore.getState();
  useChatStore.setState({
    messages: state.messages.map(m =>
      m.id === currentAssistantId
        ? {
            ...m,
            isStreaming: false,
            toolCalls: (m.toolCalls || []).map(tc =>
              tc.status === 'running' ? { ...tc, status: 'completed' as const } : tc
            ),
          }
        : m
    ),
    isGenerating: false,
  });
  currentAssistantId = null;
}

// ── Store ──

interface ChatState {
  messages: ChatMessage[];
  isGenerating: boolean;
  tokenUsage: TokenUsage;
  fileTree: FileNode[];
  diffFiles: DiffFile[];
  projectPath: string;

  setProjectPath: (path: string) => void;
  sendMessage: (text: string) => void;
  stopGeneration: () => void;
  clearChat: () => void;
  initSession: (projectPath: string, model?: string) => Promise<void>;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  isGenerating: false,
  tokenUsage: { input: 0, output: 0 },
  fileTree: isElectron() ? [] : MOCK_FILE_TREE,
  diffFiles: [],
  projectPath: '',

  setProjectPath: (path: string) => {
    set({ projectPath: path });
  },

  initSession: async (projectPath: string, model?: string) => {
    if (!isElectron()) return;

    try {
      startListening();
      const { session_id } = await claudeApi.createSession({
        projectId: 'default',
        projectPath,
      });
      activeSessionId = session_id;
      await claudeApi.startSession({
        sessionId: session_id,
        projectPath,
        model: model || undefined,
      });
      set({ projectPath });
    } catch (err) {
      console.error('[CCDesk] Failed to init session:', err);
    }
  },

  sendMessage: async (text: string) => {
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isGenerating: true,
    }));

    if (isElectron() && activeSessionId) {
      // Real mode: send to Claude CLI via Electron IPC
      try {
        await claudeApi.sendInput({ sessionId: activeSessionId, input: text });
      } catch (err) {
        console.error('[CCDesk] sendInput failed:', err);
        set({ isGenerating: false });
      }
    } else {
      // Mock mode: simulate typing
      mockTypingResponse(get, set);
    }
  },

  stopGeneration: () => {
    if (isElectron() && activeSessionId) {
      claudeApi.closeSession({ sessionId: activeSessionId });
      activeSessionId = null;
      currentAssistantId = null;
    }
    set({ isGenerating: false });
  },

  clearChat: () => {
    if (isElectron() && activeSessionId) {
      claudeApi.closeSession({ sessionId: activeSessionId });
      activeSessionId = null;
      currentAssistantId = null;
    }
    set({
      messages: [],
      isGenerating: false,
      tokenUsage: { input: 0, output: 0 },
      diffFiles: [],
    });
  },
}));

// ── Mock typing animation ──

function mockTypingResponse(
  get: () => ChatState,
  set: (fn: (state: ChatState) => Partial<ChatState>) => void,
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
    set((state) => ({ messages: [...state.messages, assistantMessage] }));

    let charIndex = 0;
    const chunkSize = 3;
    const interval = setInterval(() => {
      if (!get().isGenerating) {
        clearInterval(interval);
        finishMock(assistantId, toolCalls, set);
        return;
      }
      charIndex += chunkSize;
      if (charIndex >= fullResponse.length) {
        clearInterval(interval);
        finishMock(assistantId, toolCalls, set);
        return;
      }
      const partial = fullResponse.slice(0, charIndex);
      set((s) => ({
        messages: s.messages.map(m =>
          m.id === assistantId ? { ...m, content: partial } : m
        ),
      }));
    }, 15);
  }, 300);
}

function finishMock(
  assistantId: string,
  toolCalls: ToolCall[],
  set: (fn: (state: ChatState) => Partial<ChatState>) => void,
) {
  set((s) => ({
    messages: s.messages.map(m =>
      m.id === assistantId
        ? { ...m, isStreaming: false, toolCalls }
        : m
    ),
    isGenerating: false,
    tokenUsage: {
      input: s.tokenUsage.input + Math.floor(Math.random() * 500 + 200),
      output: s.tokenUsage.output + Math.floor(Math.random() * 1200 + 400),
    },
  }));
}
