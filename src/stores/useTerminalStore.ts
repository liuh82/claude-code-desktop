import { create } from 'zustand';

export interface OutputLine {
  stream: 'stdout' | 'stderr';
  content: string;
  timestamp: number;
}

interface TerminalState {
  outputs: Map<string, OutputLine[]>;
  appendOutput: (paneId: string, line: OutputLine) => void;
  clearOutput: (paneId: string) => void;
}

export const useTerminalStore = create<TerminalState>()((set) => ({
  outputs: new Map(),
  appendOutput: (paneId, line) => set((state) => {
    const newOutputs = new Map(state.outputs);
    const existing = newOutputs.get(paneId) || [];
    newOutputs.set(paneId, [...existing.slice(-10000), line]);
    return { outputs: newOutputs };
  }),
  clearOutput: (paneId) => set((state) => {
    const newOutputs = new Map(state.outputs);
    newOutputs.set(paneId, []);
    return { outputs: newOutputs };
  }),
}));
