import { create } from 'zustand';
import type { Session } from '@/types/session';

interface SessionState {
  sessions: Map<string, Session>;
  createSession: (projectId: string, projectPath: string) => Promise<string>;
  sendInput: (sessionId: string, input: string) => Promise<void>;
}

export const useSessionStore = create<SessionState>()(() => ({
  sessions: new Map(),
  createSession: async (_projectId, _projectPath) => 'pending',
  sendInput: async (_sessionId, _input) => {},
}));
