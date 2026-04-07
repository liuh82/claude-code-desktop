import { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { useKeyboardShortcuts } from '@/hooks/useKeyboard';
import { isElectron } from '@/lib/claude-api';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useChatStore } from '@/stores/useChatStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useTabStore } from '@/stores/useTabStore';
// import { ChatHeader } from '@/components/Chat/ChatHeader';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { ToolPanel } from '@/components/ToolPanel/ToolPanel';
import { SidebarToggle, ToolPanelToggle } from '@/components/PanelToggles';
import { ResizeHandle } from '@/components/ResizeHandle';
import { ProjectSelector } from '@/components/ProjectSelector';
import { CommandPalette, type CommandItem } from '@/components/CommandPalette';
import { SettingsDialog } from '@/components/SettingsDialog';
import { HistoryDialog } from '@/components/HistoryDialog';
import { LogViewer } from '@/components/LogViewer/LogViewer';
import { TopNav } from '@/components/TopNav';
import StatusBar from '@/components/StatusBar';
import { TabBar } from '@/components/Pane/TabBar';
import { PaneContainer } from '@/components/Pane/PaneContainer';
import type { LayoutNode } from '@/types/pane';
import './App.css';

const SIDEBAR_KEY = 'ccdesk-sidebar-v2';
const TOOLPANEL_KEY = 'ccdesk-toolpanel-v2';
const TOOLPANEL_WIDTH_KEY = 'ccdesk-toolpanel-width';

function readNum(key: string, fallback: number): number {
  try { const v = localStorage.getItem(key); if (v) return parseInt(v, 10) || fallback; } catch { /* */ }
  return fallback;
}

function readBool(key: string, fallback: boolean): boolean {
  try { const v = localStorage.getItem(key); if (v === 'true') return true; if (v === 'false') return false; } catch { /* */ }
  return fallback;
}

function saveNum(key: string, val: number) {
  try { localStorage.setItem(key, String(val)); } catch { /* */ }
}

const MIN_TOOLPANEL = 200;
const MAX_TOOLPANEL = 600;

function AppContent() {
  const { toggleTheme } = useTheme();
  const { loadSettings } = useSettingsStore();
  const stopGeneration = useChatStore((s) => s.stopGeneration);
  const { activeProject, loadProjects: loadRecentProjects, addProject, selectProject } = useProjectStore();

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logViewerOpen, setLogViewerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => readBool(SIDEBAR_KEY, true));
  const [toolPanelOpen, setToolPanelOpen] = useState(() => readBool(TOOLPANEL_KEY, false));
  const [toolPanelWidth, setToolPanelWidth] = useState(() => readNum(TOOLPANEL_WIDTH_KEY, 288));

  const projectPath = activeProject?.path ?? '';

  // Tab store
  const activeTabId = useTabStore((s) => s.activeTabId);
  const activeTab = useTabStore((s) => {
    if (!s.activeTabId) return null;
    return s.tabs.get(s.activeTabId) ?? null;
  });
  const activePaneId = activeTab?.activePaneId;
  const createTab = useTabStore((s) => s.createTab);
  const closeTab = useTabStore((s) => s.closeTab);

  useEffect(() => {
    loadSettings();
    loadRecentProjects();
  }, [loadSettings, loadRecentProjects]);

  // Listen for ccdesk settings events
  useEffect(() => {
    const handleOpen = () => setSettingsOpen(true);
    const handleClose = () => setSettingsOpen(false);
    window.addEventListener('ccdesk:open-settings', handleOpen);
    window.addEventListener('ccdesk:close-settings', handleClose);
    return () => {
      window.removeEventListener('ccdesk:open-settings', handleOpen);
      window.removeEventListener('ccdesk:close-settings', handleClose);
    };
  }, []);

  // Auto-create first tab when project opens
  useEffect(() => {
    if (projectPath && !activeTabId) {
      createTab(projectPath);
    }
  }, [projectPath, activeTabId, createTab]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_KEY, String(next)); } catch { /* */ }
      return next;
    });
  }, []);

  const toggleToolPanel = useCallback(() => {
    setToolPanelOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(TOOLPANEL_KEY, String(next)); } catch { /* */ }
      return next;
    });
  }, []);


  const handleProjectOpen = useCallback((path: string) => {
    const existing = useProjectStore.getState().projects.find((p) => p.path === path);
    if (existing) selectProject(existing);
    else addProject(path);
  }, [addProject, selectProject]);

  const handleOpenProject = useCallback(async () => {
    const api = (window as unknown as Record<string, unknown>).claudeAPI as { openDirectoryDialog?: () => Promise<string | null> } | undefined;
    if (api?.openDirectoryDialog) {
      const path = await api.openDirectoryDialog();
      if (path) handleProjectOpen(path);
    } else {
      const path = prompt('输入项目目录路径：');
      if (path?.trim()) handleProjectOpen(path.trim());
    }
  }, [handleProjectOpen]);
  const handleNewTab = useCallback(async () => {
    // Try to open directory picker (Electron) to let user choose/reconfirm folder
    try {
      if (isElectron()) {
        const api = (window as unknown as Record<string, unknown>).claudeAPI as { openDirectoryDialog?: () => Promise<string | null> } | undefined;
        if (api?.openDirectoryDialog) {
          const dir = await api.openDirectoryDialog();
          if (dir) {
            handleProjectOpen(dir);
            createTab(dir);
            return;
          }
          // User cancelled picker — use current project path
          if (projectPath) { createTab(projectPath); return; }
        }
      }
    } catch {}
    // Fallback: use current project
    if (projectPath) createTab(projectPath);
  }, [projectPath, createTab, handleProjectOpen]);


  const handleToolPanelResize = useCallback((delta: number) => {
    setToolPanelWidth((prev) => {
      const next = Math.max(MIN_TOOLPANEL, Math.min(MAX_TOOLPANEL, prev + delta));
      saveNum(TOOLPANEL_WIDTH_KEY, next);
      return next;
    });
  }, []);

  // Pane ratio change handler
  const handlePaneRatioChange = useCallback((direction: 'horizontal' | 'vertical', _dividerIndex: number, newRatios: number[]) => {
    if (!activeTab) return;
    const tab = useTabStore.getState().tabs.get(activeTab.id);
    if (!tab) return;

    function updateRatiosInLayout(layout: LayoutNode): LayoutNode {
      if (layout.type === 'leaf') return layout;
      // Only update the first split matching this direction
      if (layout.direction === direction && layout.ratios.length === newRatios.length) {
        return { ...layout, ratios: newRatios, children: layout.children.map(updateRatiosInLayout) };
      }
      return { ...layout, children: layout.children.map(updateRatiosInLayout) };
    }

    const newTabs = new Map(useTabStore.getState().tabs);
    newTabs.set(activeTab.id, { ...tab, layout: updateRatiosInLayout(tab.layout) });
    useTabStore.setState({ tabs: newTabs });
  }, [activeTab]);

  // Derive StatusBar props
  const settings = useSettingsStore((s) => s.settings);
  const paneState = activePaneId ? useChatStore((s) => s.panes.get(activePaneId)) : undefined;
  const sessionStatus: 'idle' | 'running' | 'waiting' | 'error' | 'starting' =
    paneState?.isGenerating ? 'running' : 'idle';
  const modelName = paneState?.currentModel || useChatStore((s) => s.currentModel) || settings.defaultModel || undefined;
  const tokenUsage = paneState?.tokenUsage;
  const projectName = activeProject?.name || projectPath.split('/').pop() || '';

  const commands: CommandItem[] = useMemo(
    () => [
      { id: 'new-tab', label: '新建会话', shortcut: '⌘T', category: '会话', execute: handleNewTab },
      { id: 'toggle-sidebar', label: '切换侧栏', shortcut: '⌘B', category: '视图', execute: toggleSidebar },
      { id: 'toggle-panel', label: '切换工具面板', shortcut: '⌘⇧F', category: '视图', execute: toggleToolPanel },
      { id: 'toggle-theme', label: '切换主题', category: '外观', execute: toggleTheme },
      { id: 'open-project', label: '打开项目', shortcut: '⌘O', category: '项目', execute: handleOpenProject },
      { id: 'open-settings', label: '打开设置', shortcut: '⌘,', category: '偏好设置', execute: () => setSettingsOpen(true) },
      { id: 'log-viewer', label: '日志查看器', shortcut: '⌘L', category: '工具', execute: () => setLogViewerOpen(true) },
    ],
    [handleNewTab, toggleSidebar, toggleToolPanel, toggleTheme, handleOpenProject],
  );

  const actions = useMemo(
    () => ({
      onNewChat: handleNewTab,
      onNewTab: handleNewTab,
      onToggleSidebar: toggleSidebar,
      onToggleToolPanel: toggleToolPanel,
      onOpenSettings: () => setSettingsOpen(true),
      onOpenProject: handleOpenProject,
      onCommandPalette: () => setCommandPaletteOpen(true),
      onOpenLogViewer: () => setLogViewerOpen(true),
      onOpenHistory: () => setHistoryOpen(true),
      onStopGeneration: () => {
        if (activePaneId) stopGeneration(activePaneId);
      },
      onSplitPaneHorizontal: () => {
        if (activeTab) useTabStore.getState().splitPane(activeTab.id, activeTab.activePaneId, 'horizontal');
      },
      onSplitPaneVertical: () => {
        if (activeTab) useTabStore.getState().splitPane(activeTab.id, activeTab.activePaneId, 'vertical');
      },
      onClosePane: () => {
        if (activeTab) {
          const tab = useTabStore.getState().tabs.get(activeTab.id);
          if (tab && tab.panes.size <= 1) {
            closeTab(activeTab.id);
          } else {
            useTabStore.getState().closePane(activeTab.id, activeTab.activePaneId);
          }
        }
      },
    }),
    [handleNewTab, toggleSidebar, toggleToolPanel, stopGeneration, handleOpenProject, activeTab, closeTab, activePaneId],
  );

  useKeyboardShortcuts(actions);

  if (!activeProject) {
    return (
      <ThemeProvider>
        <ProjectSelector onProjectOpen={handleProjectOpen} />
        <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} commands={commands} />
      </ThemeProvider>
    );
  }

  return (
    <div className="appLayout">
      <TopNav projectName={projectName} onOpenSettings={() => setSettingsOpen(true)} />

      <div className="appBody">
        <SidebarToggle sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
        {sidebarOpen && (
          <>
            <Sidebar
              projectPath={projectPath}
              onNewChat={handleNewTab}
              onClose={toggleSidebar}
              onOpenSettings={() => setSettingsOpen(true)}
              onToggleTheme={toggleTheme}
              onOpenHistory={() => setHistoryOpen(true)}
              onSearch={() => setCommandPaletteOpen(true)}
            />
          </>
        )}

        {/* Main content area with tabs */}
        <div className="appMainContent">
          <TabBar projectPath={projectPath} />
          {/* <ChatHeader /> */}
          {activeTab ? (
            <PaneContainer
              layout={activeTab.layout}
              tabId={activeTab.id}
              activePaneId={activeTab.activePaneId}
              onRatioChange={handlePaneRatioChange}
            />
          ) : (
            <div className="appEmptyState">
              按 ⌘T 新建会话
            </div>
          )}
        </div>

        {toolPanelOpen && (
          <>
            <ResizeHandle direction="right" onResize={handleToolPanelResize} />
            <ToolPanel
              onClose={toggleToolPanel}
              style={{ width: toolPanelWidth, minWidth: toolPanelWidth, maxWidth: toolPanelWidth }}
            />
          </>
        )}
        <ToolPanelToggle toolPanelOpen={toolPanelOpen} onToggleToolPanel={toggleToolPanel} />
      </div>

      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} commands={commands} />
      <HistoryDialog
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelectSession={(id) => console.log('Load session:', id)}
        projectPath={projectPath}
      />
      <SettingsDialog isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {logViewerOpen && <LogViewer onClose={() => setLogViewerOpen(false)} />}
      <StatusBar
        sessionStatus={sessionStatus}
        modelName={modelName}
        tokenUsage={tokenUsage}
        projectPath={projectPath}
        connected={true}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
