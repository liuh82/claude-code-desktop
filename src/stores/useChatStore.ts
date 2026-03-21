import { create } from 'zustand';
import type { ChatMessage, ToolCall } from '@/types/chat';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Mock AI responses for Phase 1
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

Here's a diff preview of what I plan to do:

\`\`\`diff
- old implementation
+ new implementation
\`\`\`

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
    {
      id: 'tool-1',
      name: 'Read',
      status: 'completed',
      input: { file_path: 'src/app/App.tsx' },
      output: '// File contents here...',
      duration: 120,
    },
  ],
  [
    {
      id: 'tool-2',
      name: 'Read',
      status: 'completed',
      input: { file_path: 'src/components/ChatView.tsx' },
      output: '// Component contents...',
      duration: 80,
    },
    {
      id: 'tool-3',
      name: 'Write',
      status: 'completed',
      input: { file_path: 'src/components/ChatView.tsx', content: '// Updated contents...' },
      duration: 200,
    },
  ],
  [],
];

interface ChatState {
  messages: ChatMessage[];
  isGenerating: boolean;

  sendMessage: (text: string) => void;
  stopGeneration: () => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  isGenerating: false,

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

    // Mock AI response with typing effect
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

    // Add empty assistant message
    setTimeout(() => {
      set((state) => ({
        messages: [...state.messages, assistantMessage],
      }));

      // Start typing effect
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
          }));
        }
      }, 15);
    }, 300);
  },

  stopGeneration: () => {
    set({ isGenerating: false });
  },

  clearChat: () => {
    set({ messages: [], isGenerating: false });
  },
}));
