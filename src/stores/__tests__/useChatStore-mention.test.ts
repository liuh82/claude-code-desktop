import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '../useChatStore';

// Mock claude-api to prevent electron IPC calls
vi.mock('@/lib/claude-api', () => ({
  claudeApi: {
    onClaudeOutput: () => () => {},
    onClaudeStderr: () => () => {},
    onClaudeExit: () => () => {},
    onClaudeError: () => () => {},
  },
  isElectron: () => false,
}));

// Mock claude-parser to prevent import issues
vi.mock('@/lib/claude-parser', () => ({
  parseClaudeLine: () => null,
  extractModel: () => null,
  isDirectApiLine: () => false,
  parseDirectApiLine: () => null,
}));

import { vi } from 'vitest';

describe('useChatStore — pendingFileMention', () => {
  beforeEach(() => {
    // Reset store state
    useChatStore.setState({ pendingFileMention: null });
  });

  it('initial state is null', () => {
    expect(useChatStore.getState().pendingFileMention).toBeNull();
  });

  it('triggerFileMention sets pendingFileMention', () => {
    useChatStore.getState().triggerFileMention('/src/components/App.tsx');

    expect(useChatStore.getState().pendingFileMention).toBe('/src/components/App.tsx');
  });

  it('consumeFileMention returns the path and clears it', () => {
    useChatStore.getState().triggerFileMention('/src/stores/useChatStore.ts');

    const result = useChatStore.getState().consumeFileMention();

    expect(result).toBe('/src/stores/useChatStore.ts');
    expect(useChatStore.getState().pendingFileMention).toBeNull();
  });

  it('consumeFileMention returns null when nothing pending', () => {
    const result = useChatStore.getState().consumeFileMention();

    expect(result).toBeNull();
  });

  it('consecutive consume returns null on second call', () => {
    useChatStore.getState().triggerFileMention('/src/app.tsx');

    const first = useChatStore.getState().consumeFileMention();
    const second = useChatStore.getState().consumeFileMention();

    expect(first).toBe('/src/app.tsx');
    expect(second).toBeNull();
  });

  it('trigger overwrites previous value', () => {
    useChatStore.getState().triggerFileMention('/first/path.ts');
    useChatStore.getState().triggerFileMention('/second/path.ts');

    expect(useChatStore.getState().pendingFileMention).toBe('/second/path.ts');

    const result = useChatStore.getState().consumeFileMention();
    expect(result).toBe('/second/path.ts');
  });
});
