import { create } from 'zustand';
import type { ChatMessage, ToolCall, FileNode, DiffFile, TokenUsage } from '@/types/chat';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Mock AI responses
const MOCK_RESPONSES = [
  `I'll help you with that. Let me start by examining the current code structure.

Here's a quick example in TypeScript:

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const result = greet("World");
console.log(result); // "Hello, World!"
\`\`\`

Let me also check the project files to understand the context better.`,

  `Good question! Here's my analysis:

**Key Points:**
- The architecture follows a clean separation of concerns
- State management uses Zustand for simplicity
- Component structure is modular and reusable

Here's a code example showing the pattern:

\`\`\`python
class DataProcessor:
    def __init__(self, source: str):
        self.source = source
        self.data = []

    def process(self) -> list:
        """Process and return cleaned data."""
        self.data = self._load()
        return self._transform(self.data)
\`\`\`

Would you like me to elaborate on any of these points?`,

  `Sure, I can handle that. Let me read the relevant files first and then make the necessary changes.

1. First, I'll examine the current implementation
2. Then propose the changes
3. Finally implement them

This should resolve the issue without breaking existing functionality.`,

  `I've completed the analysis. Here's a summary:

| Item | Status | Details |
|------|--------|---------|
| Code Review | Done | No critical issues found |
| Tests | Passing | 42/42 tests pass |
| Performance | Good | No bottlenecks detected |

The changes are minimal and focused. The main improvement is reducing unnecessary re-renders by using \`useMemo\` for computed values.`,
];

const MOCK_TOOL_CALLS: ToolCall[][] = [
  [
    { id: 'tool-1', name: 'ReadFile', status: 'completed', input: { file_path: 'src/app/App.tsx' }, output: 'import { ... } from ...', duration: 120 },
  ],
  [
    { id: 'tool-2', name: 'ReadFile', status: 'completed', input: { file_path: 'src/components/Chat/ChatView.tsx' }, output: '// Component contents...', duration: 80 },
    { id: 'tool-3', name: 'WriteFile', status: 'completed', input: { file_path: 'src/components/Chat/ChatView.tsx', content: '// Updated contents...' }, duration: 200 },
  ],
  [
    { id: 'tool-4', name: 'ExecuteCommand', status: 'running', input: { command: 'npm run build' } },
  ],
  [],
];

// Mock file tree
const MOCK_FILE_TREE: FileNode[] = [
  {
    name: 'src', path: 'src', type: 'directory',
    children: [
      { name: 'app', path: 'src/app', type: 'directory', children: [
        { name: 'App.tsx', path: 'src/app/App.tsx', type: 'file', status: 'modified' },
        { name: 'App.css', path: 'src/app/App.css', type: 'file' },
      ] },
      { name: 'components', path: 'src/components', type: 'directory', children: [
        { name: 'Chat', path: 'src/components/Chat', type: 'directory', children: [
          { name: 'ChatView.tsx', path: 'src/components/Chat/ChatView.tsx', type: 'file', status: 'modified' },
          { name: 'MessageBubble.tsx', path: 'src/components/Chat/MessageBubble.tsx', type: 'file', status: 'added' },
          { name: 'InputArea.tsx', path: 'src/components/Chat/InputArea.tsx', type: 'file' },
          { name: 'CodeBlock.tsx', path: 'src/components/Chat/CodeBlock.tsx', type: 'file' },
          { name: 'MarkdownRenderer.tsx', path: 'src/components/Chat/MarkdownRenderer.tsx', type: 'file' },
          { name: 'ToolCallBlock.tsx', path: 'src/components/Chat/ToolCallBlock.tsx', type: 'file', status: 'modified' },
        ] },
        { name: 'Sidebar', path: 'src/components/Sidebar', type: 'directory', children: [
          { name: 'Sidebar.tsx', path: 'src/components/Sidebar/Sidebar.tsx', type: 'file' },
        ] },
        { name: 'ToolPanel', path: 'src/components/ToolPanel', type: 'directory', children: [
          { name: 'ToolPanel.tsx', path: 'src/components/ToolPanel/ToolPanel.tsx', type: 'file' },
          { name: 'FileTree.tsx', path: 'src/components/ToolPanel/FileTree.tsx', type: 'file', status: 'added' },
          { name: 'DiffView.tsx', path: 'src/components/ToolPanel/DiffView.tsx', type: 'file', status: 'added' },
        ] },
        { name: 'CommandPalette.tsx', path: 'src/components/CommandPalette.tsx', type: 'file' },
        { name: 'SettingsDialog.tsx', path: 'src/components/SettingsDialog.tsx', type: 'file' },
        { name: 'ErrorBoundary.tsx', path: 'src/components/ErrorBoundary.tsx', type: 'file' },
      ] },
      { name: 'stores', path: 'src/stores', type: 'directory', children: [
        { name: 'useChatStore.ts', path: 'src/stores/useChatStore.ts', type: 'file', status: 'modified' },
        { name: 'useSettingsStore.ts', path: 'src/stores/useSettingsStore.ts', type: 'file' },
        { name: 'useSessionStore.ts', path: 'src/stores/useSessionStore.ts', type: 'file' },
      ] },
      { name: 'theme', path: 'src/theme', type: 'directory', children: [
        { name: 'theme.tsx', path: 'src/theme/theme.tsx', type: 'file' },
      ] },
      { name: 'types', path: 'src/types', type: 'directory', children: [
        { name: 'chat.ts', path: 'src/types/chat.ts', type: 'file' },
      ] },
      { name: 'hooks', path: 'src/hooks', type: 'directory', children: [
        { name: 'useKeyboard.ts', path: 'src/hooks/useKeyboard.ts', type: 'file' },
      ] },
      { name: 'styles', path: 'src/styles', type: 'directory', children: [
        { name: 'globals.css', path: 'src/styles/globals.css', type: 'file' },
      ] },
      { name: 'main.tsx', path: 'src/main.tsx', type: 'file' },
    ],
  },
  { name: 'package.json', path: 'package.json', type: 'file', status: 'modified' },
  { name: 'tsconfig.json', path: 'tsconfig.json', type: 'file' },
  { name: 'vite.config.ts', path: 'vite.config.ts', type: 'file' },
  { name: 'README.md', path: 'README.md', type: 'file' },
];

// Mock diff data
const MOCK_DIFF_FILES: DiffFile[] = [
  {
    filePath: 'src/app/App.tsx',
    status: 'modified',
    hunks: [
      {
        header: '@@ -1,8 +1,10 @@',
        lines: [
          { type: 'context', content: ' import { useCallback, useEffect, useMemo, useState } from \'react\';', oldLineNumber: 1, newLineNumber: 1 },
          { type: 'context', content: ' import { ThemeProvider, useTheme } from \'@/theme/theme\';', oldLineNumber: 2, newLineNumber: 2 },
          { type: 'delete', content: '-import { Toolbar } from \'@/components/Toolbar/Toolbar\';', oldLineNumber: 3 },
          { type: 'add', content: '+import { Sidebar } from \'@/components/Sidebar/Sidebar\';', newLineNumber: 3 },
          { type: 'context', content: ' import { ChatView } from \'@/components/Chat/ChatView\';', oldLineNumber: 4, newLineNumber: 4 },
          { type: 'context', content: ' ', oldLineNumber: 5, newLineNumber: 5 },
          { type: 'delete', content: '-      <Toolbar projectPath={projectPath} />', oldLineNumber: 6 },
          { type: 'delete', content: '-', oldLineNumber: 7 },
          { type: 'add', content: '+      {/* Three-column layout */}', newLineNumber: 6 },
          { type: 'add', content: '+      <div className="appBody">', newLineNumber: 7 },
        ],
      },
    ],
  },
  {
    filePath: 'src/components/Chat/MessageBubble.tsx',
    status: 'added',
    hunks: [
      {
        header: '@@ -0,0 +1,44 @@',
        lines: [
          { type: 'add', content: 'import type { ChatMessage } from \'@/types/chat\';', newLineNumber: 1 },
          { type: 'add', content: 'import { MarkdownRenderer } from \'./MarkdownRenderer\';', newLineNumber: 2 },
          { type: 'add', content: 'import { ToolCallBlock } from \'./ToolCallBlock\';', newLineNumber: 3 },
          { type: 'add', content: 'import styles from \'./MessageBubble.module.css\';', newLineNumber: 4 },
          { type: 'add', content: '', newLineNumber: 5 },
          { type: 'add', content: 'interface MessageBubbleProps {', newLineNumber: 6 },
          { type: 'add', content: '  message: ChatMessage;', newLineNumber: 7 },
          { type: 'add', content: '}', newLineNumber: 8 },
        ],
      },
    ],
  },
  {
    filePath: 'src/stores/useChatStore.ts',
    status: 'modified',
    hunks: [
      {
        header: '@@ -10,6 +10,14 @@',
        lines: [
          { type: 'context', content: '  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;', oldLineNumber: 10, newLineNumber: 10 },
          { type: 'context', content: '}', oldLineNumber: 11, newLineNumber: 11 },
          { type: 'delete', content: '-// Mock data', oldLineNumber: 12 },
          { type: 'add', content: '+// Mock data with file tree and diff', newLineNumber: 12 },
          { type: 'add', content: '+const MOCK_FILE_TREE: FileNode[] = [/* ... */];', newLineNumber: 13 },
          { type: 'add', content: '+const MOCK_DIFF_FILES: DiffFile[] = [/* ... */];', newLineNumber: 14 },
        ],
      },
    ],
  },
];

// Mock token usage
const MOCK_TOKEN_USAGE: TokenUsage = { input: 2847, output: 1203 };

interface ChatState {
  messages: ChatMessage[];
  isGenerating: boolean;
  tokenUsage: TokenUsage;
  fileTree: FileNode[];
  diffFiles: DiffFile[];

  sendMessage: (text: string) => void;
  stopGeneration: () => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  isGenerating: false,
  tokenUsage: MOCK_TOKEN_USAGE,
  fileTree: MOCK_FILE_TREE,
  diffFiles: MOCK_DIFF_FILES,

  sendMessage: (text: string) => {
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
      set((state) => ({
        messages: [...state.messages, assistantMessage],
      }));

      let charIndex = 0;
      const chunkSize = 3;
      const typeInterval = setInterval(() => {
        const state = get();
        if (!state.isGenerating) {
          clearInterval(typeInterval);
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId
                ? { ...m, isStreaming: false, toolCalls }
                : m
            ),
            isGenerating: false,
            tokenUsage: {
              input: s.tokenUsage.input + Math.floor(Math.random() * 500 + 200),
              output: s.tokenUsage.output + Math.floor(fullResponse.length * 1.3),
            },
          }));
          return;
        }

        charIndex += chunkSize;
        const partial = fullResponse.slice(0, charIndex);

        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantId ? { ...m, content: partial } : m
          ),
        }));

        if (charIndex >= fullResponse.length) {
          clearInterval(typeInterval);
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId
                ? { ...m, isStreaming: false, toolCalls }
                : m
            ),
            isGenerating: false,
            tokenUsage: {
              input: s.tokenUsage.input + Math.floor(Math.random() * 500 + 200),
              output: s.tokenUsage.output + Math.floor(fullResponse.length * 1.3),
            },
          }));
        }
      }, 15);
    }, 300);
  },

  stopGeneration: () => {
    set({ isGenerating: false });
  },

  clearChat: () => {
    set({ messages: [], isGenerating: false, tokenUsage: { input: 0, output: 0 } });
  },
}));
