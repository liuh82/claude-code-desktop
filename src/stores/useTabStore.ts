import { create } from 'zustand';
import type { Tab } from '@/types/tab';

interface TabState {
  tabs: Map<string, Tab>;
  activeTabId: string | null;
  createTab: (projectId: string, projectPath: string, title: string) => Promise<Tab>;
  closeTab: (tabId: string) => Promise<void>;
  switchTab: (tabId: string) => void;
}

export const useTabStore = create<TabState>()((set) => ({
  tabs: new Map(),
  activeTabId: null,
  createTab: async (_projectId, _projectPath, _title) => {
    // TODO: Phase 4 - invoke('create_tab', ...)
    const tab: Tab = { tabId: 'pending', projectId: _projectId, projectPath: _projectPath, title: _title, activePaneId: '', createdAt: Date.now(), updatedAt: Date.now() };
    return tab;
  },
  closeTab: async (_tabId) => {},
  switchTab: (tabId) => set({ activeTabId: tabId }),
}));
