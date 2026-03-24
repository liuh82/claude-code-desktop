import { create } from 'zustand';
import type { Tab, Pane, LayoutNode } from '@/types/pane';
import type { SavedTabState } from '@/types/chat';
import { claudeApi, isElectron } from '@/lib/claude-api';
import {
  createDefaultTab,
  generateTabId,
  generatePaneId,
  createLeaf,
  createSplit,
  findSplitForPane,
  countPanes,
} from '@/types/pane';

const MAX_TABS = 10;
const MAX_PANES_PER_TAB = 2;

interface TabState {
  tabs: Map<string, Tab>;
  activeTabId: string | null;
  tabOrder: string[]; /* ordered tab IDs */
  projectPaths: Map<string, string>; /* paneId → projectPath */

  // Actions
  createTab: (projectPath: string, title?: string) => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  renameTab: (tabId: string, title: string) => void;

  // Pane actions
  splitPane: (tabId: string, paneId: string, direction: 'horizontal' | 'vertical') => void;
  closePane: (tabId: string, paneId: string) => void;
  setActivePane: (tabId: string, paneId: string) => void;
  setPaneStatus: (tabId: string, paneId: string, status: Pane['status']) => void;
  updatePaneRatio: (tabId: string, paneId: string, ratio: number) => void;
  setPaneProject: (paneId: string, projectPath: string) => void;
  getActiveTab: () => Tab | null;
  restoreTabs: (projectPath: string) => Promise<void>;
  saveTabs: (projectPath: string) => Promise<void>;
}

function updateLayoutRatio(
  layout: LayoutNode,
  targetPaneId: string,
  ratio: number,
): LayoutNode {
  if (layout.type === 'leaf') return layout;

  const newChildren = [...layout.children];
  const newRatios = [...layout.ratios];

  for (let i = 0; i < newChildren.length; i++) {
    const child = newChildren[i];
    if (child.type === 'leaf' && child.paneId === targetPaneId) {
      // Adjust ratios: this child gets `ratio`, siblings share 1-ratio
      const otherCount = newChildren.length - 1;
      const remaining = 1 - ratio;
      for (let j = 0; j < newRatios.length; j++) {
        if (j === i) {
          newRatios[j] = Math.max(0.1, ratio);
        } else {
          newRatios[j] = otherCount > 0 ? Math.max(0.05, remaining / otherCount) : 0;
        }
      }
      return { ...layout, children: newChildren, ratios: newRatios };
    }
    if (child.type === 'split') {
      const updated = updateLayoutRatio(child, targetPaneId, ratio);
      if (updated !== child) {
        newChildren[i] = updated;
        return { ...layout, children: newChildren };
      }
    }
  }

  return layout;
}

export const useTabStore = create<TabState>()((set, get) => ({
  tabs: new Map(),
  activeTabId: null,
  tabOrder: [],
  projectPaths: new Map(),

  createTab: (projectPath: string, title?: string) => {
    const state = get();
    const tabId = generateTabId();
    const tab = createDefaultTab(tabId, projectPath, title || 'Session 1');

    // Auto-number
    const sessionNum = state.tabOrder.length + 1;
    tab.title = title || `Session ${sessionNum}`;

    const newTabs = new Map(state.tabs);
    newTabs.set(tabId, tab);
    const newOrder = [...state.tabOrder, tabId];

    // Store project path for the initial pane
    const newProjectPaths = new Map(state.projectPaths);
    newProjectPaths.set(tab.activePaneId, projectPath);

    // Enforce max tabs
    while (newOrder.length > MAX_TABS) {
      const oldest = newOrder.shift()!;
      newTabs.delete(oldest);
    }

    set({ tabs: newTabs, activeTabId: tabId, tabOrder: newOrder, projectPaths: newProjectPaths });
    return tabId;
  },

  closeTab: (tabId: string) => {
    const state = get();
    const newTabs = new Map(state.tabs);
    newTabs.delete(tabId);
    const newOrder = state.tabOrder.filter((id) => id !== tabId);

    let newActiveId = state.activeTabId;
    if (newActiveId === tabId) {
      if (newOrder.length > 0) {
        const closedIdx = state.tabOrder.indexOf(tabId);
        newActiveId = newOrder[Math.min(closedIdx, newOrder.length - 1)];
      } else {
        newActiveId = null;
      }
    }

    set({ tabs: newTabs, activeTabId: newActiveId, tabOrder: newOrder });
  },

  setActiveTab: (tabId: string) => {
    set({ activeTabId: tabId });
  },

  renameTab: (tabId: string, title: string) => {
    const state = get();
    const tab = state.tabs.get(tabId);
    if (!tab) return;
    const newTabs = new Map(state.tabs);
    newTabs.set(tabId, { ...tab, title });
    set({ tabs: newTabs });
  },

  splitPane: (tabId: string, paneId: string, direction: 'horizontal' | 'vertical') => {
    const state = get();
    const tab = state.tabs.get(tabId);
    if (!tab) return;
    if (countPanes(tab.layout) >= MAX_PANES_PER_TAB) return;

    const newPaneId = generatePaneId(tabId);
    const newPane: Pane = {
      id: newPaneId,
      tabId,
      title: `Terminal ${countPanes(tab.layout) + 1}`,
      status: 'idle',
    };

    const split = findSplitForPane(tab.layout, paneId);
    let newLayout: LayoutNode;

    if (split) {
      // Replace the leaf at the split position with a new split node
      const newChildren = [...split.parent.children];
      const newRatios = [...split.parent.ratios];
      const idx = split.index;

      const splitNode = createSplit(
        direction,
        createLeaf(paneId),
        createLeaf(newPaneId),
        0.5,
      );

      newChildren[idx] = splitNode;
      newRatios[idx] = split.parent.ratios[idx];

      // Update the parent in the full layout tree
      newLayout = replaceChild(tab.layout, split.parent, { ...split.parent, children: newChildren, ratios: newRatios });
    } else {
      // Tab has a single leaf — wrap in a split
      newLayout = createSplit(
        direction,
        createLeaf(paneId),
        createLeaf(newPaneId),
        0.5,
      );
    }

    const newPanes = new Map(tab.panes);
    newPanes.set(newPaneId, newPane);

    const newTabs = new Map(state.tabs);
    newTabs.set(tabId, {
      ...tab,
      layout: newLayout,
      panes: newPanes,
      activePaneId: newPaneId,
    });

    // Copy projectPath from source pane to new pane
    const newProjectPaths = new Map(state.projectPaths);
    const sourcePath = newProjectPaths.get(paneId) || tab.projectPath;
    newProjectPaths.set(newPaneId, sourcePath);

    set({ tabs: newTabs, projectPaths: newProjectPaths });
  },

  closePane: (tabId: string, paneId: string) => {
    const state = get();
    const tab = state.tabs.get(tabId);
    if (!tab) return;

    // Don't close the last pane
    if (countPanes(tab.layout) <= 1) return;

    const newLayout = removeLeafFromLayout(tab.layout, paneId);
    if (!newLayout) return;

    const newPanes = new Map(tab.panes);
    newPanes.delete(paneId);

    const remainingPaneIds = collectAllPaneIds(newLayout);
    const newActiveId = tab.activePaneId === paneId
      ? remainingPaneIds[0]
      : tab.activePaneId;

    const newTabs = new Map(state.tabs);
    newTabs.set(tabId, {
      ...tab,
      layout: newLayout,
      panes: newPanes,
      activePaneId: newActiveId,
    });

    // Clean up projectPath for closed pane
    const newProjectPaths = new Map(state.projectPaths);
    newProjectPaths.delete(paneId);

    set({ tabs: newTabs, projectPaths: newProjectPaths });
  },

  setActivePane: (tabId: string, paneId: string) => {
    const state = get();
    const tab = state.tabs.get(tabId);
    if (!tab || !tab.panes.has(paneId)) return;
    const newTabs = new Map(state.tabs);
    newTabs.set(tabId, { ...tab, activePaneId: paneId });
    set({ tabs: newTabs });
  },

  setPaneStatus: (tabId: string, paneId: string, status: Pane['status']) => {
    const state = get();
    const tab = state.tabs.get(tabId);
    if (!tab) return;
    const pane = tab.panes.get(paneId);
    if (!pane) return;
    const newPanes = new Map(tab.panes);
    newPanes.set(paneId, { ...pane, status });
    const newTabs = new Map(state.tabs);
    newTabs.set(tabId, { ...tab, panes: newPanes });
    set({ tabs: newTabs });
  },

  updatePaneRatio: (tabId: string, paneId: string, ratio: number) => {
    const state = get();
    const tab = state.tabs.get(tabId);
    if (!tab) return;
    const newLayout = updateLayoutRatio(tab.layout, paneId, Math.max(0.1, Math.min(0.9, ratio)));
    const newTabs = new Map(state.tabs);
    newTabs.set(tabId, { ...tab, layout: newLayout });
    set({ tabs: newTabs });
  },

  setPaneProject: (paneId: string, projectPath: string) => {
    const newProjectPaths = new Map(get().projectPaths);
    newProjectPaths.set(paneId, projectPath);
    set({ projectPaths: newProjectPaths });
  },

  restoreTabs: async (projectPath: string) => {
    if (!isElectron()) return;

    const saved = await claudeApi.loadTabState({ projectPath });
    if (!saved) return;

    // Reconstruct tabs from saved state
    const newTabs = new Map<string, Tab>();
    for (const tabData of saved.tabs) {
      // Reconstruct panes Map from serialized array
      const panes = new Map<string, Pane>();
      for (const p of tabData.panes) {
        panes.set(p.id, { ...p, tabId: tabData.id, status: p.status as Pane['status'] });
      }

      newTabs.set(tabData.id, {
        id: tabData.id,
        title: tabData.title,
        activePaneId: tabData.activePaneId,
        layout: tabData.layout as LayoutNode,
        panes,
        projectPath: tabData.projectPath || projectPath,
        createdAt: tabData.createdAt,
      });
    }

    const newProjectPaths = new Map<string, string>();
    for (const entry of saved.projectPaths) {
      newProjectPaths.set(entry.paneId, entry.projectPath);
    }

    set({
      tabs: newTabs,
      activeTabId: saved.activeTabId,
      tabOrder: saved.tabOrder,
      projectPaths: newProjectPaths,
    });
  },

  saveTabs: async (projectPath: string) => {
    if (!isElectron()) return;

    const state = get();
    if (state.tabs.size === 0) return;

    // Serialize tabs (Map → Array for JSON)
    const tabsArray = Array.from(state.tabs.values()).map((tab) => ({
      id: tab.id,
      title: tab.title,
      activePaneId: tab.activePaneId,
      layout: tab.layout,
      panes: Array.from(tab.panes.values()),
      projectPath: tab.projectPath,
      createdAt: tab.createdAt,
    }));

    const projectPathsArray = Array.from(state.projectPaths.entries()).map(
      ([paneId, path]) => ({ paneId, projectPath: path })
    );

    const tabData: SavedTabState = {
      tabs: tabsArray,
      activeTabId: state.activeTabId,
      tabOrder: state.tabOrder,
      projectPaths: projectPathsArray,
    };

    await claudeApi.saveTabState({ projectPath, tabData });
  },

  getActiveTab: () => {
    const state = get();
    if (!state.activeTabId) return null;
    return state.tabs.get(state.activeTabId) ?? null;
  },
}));

// ── Helpers ──

function collectAllPaneIds(layout: LayoutNode): string[] {
  if (layout.type === 'leaf') return [layout.paneId];
  return layout.children.flatMap(collectAllPaneIds);
}

/** Replace a specific node in the layout tree */
function replaceChild(
  layout: LayoutNode,
  target: LayoutNode,
  replacement: LayoutNode,
): LayoutNode {
  if (layout === target) return replacement;
  if (layout.type === 'leaf') return layout;
  return {
    ...layout,
    children: layout.children.map((c) => replaceChild(c, target, replacement)),
  };
}

/** Remove a leaf node, collapsing its parent split */
function removeLeafFromLayout(layout: LayoutNode, paneId: string): LayoutNode | null {
  if (layout.type === 'leaf') {
    return layout.paneId === paneId ? null : layout;
  }

  // Check direct children
  const targetIdx = layout.children.findIndex(
    (c) => c.type === 'leaf' && c.paneId === paneId,
  );

  if (targetIdx >= 0) {
    if (layout.children.length === 2) {
      // Collapse: return the sibling
      const siblingIdx = targetIdx === 0 ? 1 : 0;
      return layout.children[siblingIdx];
    }
    // Remove the child and its ratio
    const newChildren = layout.children.filter((_, i) => i !== targetIdx);
    const newRatios = layout.ratios.filter((_, i) => i !== targetIdx);
    // Re-normalize ratios
    const total = newRatios.reduce((a, b) => a + b, 0);
    const normalizedRatios = total > 0 ? newRatios.map((r) => r / total) : newRatios;
    return { ...layout, children: newChildren, ratios: normalizedRatios };
  }

  // Recurse
  const newChildren = layout.children.map((c) => {
    if (c.type === 'split') {
      const result = removeLeafFromLayout(c, paneId);
      if (result === null) {
        // This whole child was the target — shouldn't happen for split, but handle
        return c;
      }
      if (result !== c) {
        // The child was modified
        // If result is a leaf and we had only 2 children, flatten
        if (result.type === 'leaf' && layout.children.length === 2) {
          // Return the other child
          const otherIdx = layout.children.indexOf(c) === 0 ? 1 : 0;
          return layout.children[otherIdx];
        }
      }
      return result;
    }
    return c;
  });

  return { ...layout, children: newChildren };
}
