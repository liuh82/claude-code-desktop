export interface Session {
  id: string;
  projectId: string;
  projectPath: string;
  paneId: string;
  title: string;
  status: 'idle' | 'starting' | 'running' | 'waiting' | 'error' | 'closed';
  processId?: number;
  createdAt: number;
  updatedAt: number;
}
