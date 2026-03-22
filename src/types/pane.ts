/* ═══ Pane Layout Types ═══ */

export interface LayoutLeaf {
  type: 'leaf';
  paneId: string;
}

export interface LayoutSplit {
  type: 'split';
  direction: 'horizontal' | 'vertical';
  children: LayoutNode[];
  ratios: number[]; /* flex-grow ratios for each child */
}

export type LayoutNode = LayoutLeaf | LayoutSplit;

export interface Pane {
  id: string;
  tabId: string;
  title: string;
  sessionId?: string;
  status: 'idle' | 'starting' | 'running' | 'waiting' | 'error' | 'closed';
}

export interface Tab {
  id: string;
  title: string;
  activePaneId: string;
  layout: LayoutNode;
  panes: Map<string, Pane>;
  projectPath: string;
  createdAt: number;
}

export function createLeaf(paneId: string): LayoutLeaf {
  return { type: 'leaf', paneId };
}

export function createSplit(
  direction: 'horizontal' | 'vertical',
  left: LayoutNode,
  right: LayoutNode,
  leftRatio: number = 0.5,
): LayoutSplit {
  return {
    type: 'split',
    direction,
    children: [left, right],
    ratios: [leftRatio, 1 - leftRatio],
  };
}

export function createDefaultTab(tabId: string, projectPath: string, title: string = 'New Session'): Tab {
  const paneId = `pane-${tabId}-0`;
  const pane: Pane = {
    id: paneId,
    tabId,
    title: 'Terminal',
    status: 'idle',
  };
  const panes = new Map<string, Pane>([[paneId, pane]]);
  return {
    id: tabId,
    title,
    activePaneId: paneId,
    layout: createLeaf(paneId),
    panes,
    projectPath,
    createdAt: Date.now(),
  };
}

/** Find the LayoutSplit that contains a given paneId */
export function findSplitForPane(
  layout: LayoutNode,
  paneId: string,
): { parent: LayoutSplit; index: number } | null {
  if (layout.type === 'leaf') return null;
  for (let i = 0; i < layout.children.length; i++) {
    const child = layout.children[i];
    if (child.type === 'leaf' && child.paneId === paneId) {
      return { parent: layout, index: i };
    }
    if (child.type === 'split') {
      const found = findSplitForPane(child, paneId);
      if (found) return found;
    }
  }
  return null;
}

/** Collect all pane IDs from a layout tree */
export function collectPaneIds(layout: LayoutNode): string[] {
  if (layout.type === 'leaf') return [layout.paneId];
  return layout.children.flatMap(collectPaneIds);
}

/** Count total panes in a layout */
export function countPanes(layout: LayoutNode): number {
  return collectPaneIds(layout).length;
}

/** Generate a unique pane ID */
export function generatePaneId(tabId: string): string {
  return `pane-${tabId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Generate a unique tab ID */
export function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
