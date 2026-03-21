import { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { useKeyboardShortcuts } from '@/hooks/useKeyboard';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useChatStore } from '@/stores/useChatStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { ChatView } from '@/components/Chat/ChatView';
import { ToolPanel } from '@/components/ToolPanel/ToolPanel';
import { SidebarToggle, ToolPanelToggle } from '@/components/PanelToggles';
import { ResizeHandle } from '@/components/ResizeHandle';
import { ProjectSelector } from '@/components/ProjectSelector';
import { CommandPalette, type CommandItem } from '@/components/CommandPalette';
import { SettingsDialog } from '@/components/SettingsDialog';
import './App.css';

const SIDEBAR_KEY = 'ccdesk-sidebar-v2';
const TOOLPANEL_KEY = 'ccdesk-toolpanel-v2';
const SIDEBAR_WIDTH_KEY = 'ccdesk-sidebar-width';
const TOOLPANEL_WIDTH_KEY = 'ccdesk-toolpanel-width';

function readNum(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v) return parseInt(v, 10) || fallback;
  } catch { /* ignore */ }
  return fallback;
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === 'true') return true;
    if (v === 'false') return false;
  } catch { /* ignore */ }
  return fallback;
}

function saveNum(key: string, val: number) {
  try { localStorage.setItem(key, String(val)); } catch { /* ignore */ }
}

const MIN_SIDEBAR = 180;
const MAX_SIDEBAR = 400;
const MIN_TOOLPANEL = 200;
const MAX_TOOLPANEL = 600;

function AppContent() {
  const { toggleTheme } = useTheme();
  const { loadSettings } = useSettingsStore();
  const clearChat = useChatStore((s) => s.clearChat);
  const stopGeneration = useChatStore((s) => s.stopGeneration);
  const initSession = useChatStore((s) => s.initSession);
  const { activeProject, loadProjects: loadRecentProjects, addProject, selectProject } = useProjectStore();

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => readBool(SIDEBAR_KEY, true));
  const [toolPanelOpen, setToolPanelOpen] = useState(() => readBool(TOOLPANEL_KEY, true));
  const [sidebarWidth, setSidebarWidth] = useState(() => readNum(SIDEBAR_WIDTH_KEY, 260));
  const [toolPanelWidth, setToolPanelWidth] = useState(() => readNum(TOOLPANEL_WIDTH_KEY, 300));

  const projectPath = activeProject?.path ?? '';

  useEffect(() => {
    loadSettings();
    loadRecentProjects();
  }, [loadSettings, loadRecentProjects]);

  // Init Claude session when project path changes
  useEffect(() => {
    if (projectPath) {
      initSession(projectPath);
    }
  }, [projectPath, initSession]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toggleToolPanel = useCallback(() => {
    setToolPanelOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(TOOLPANEL_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const handleNewChat = useCallback(() => {
    clearChat();
    // Re-init session after clearing
    if (projectPath) {
      initSession(projectPath);
    }
  }, [clearChat, initSession, projectPath]);

  const handleProjectOpen = useCallback((path: string) => {
    const existing = useProjectStore.getState().projects.find((p) => p.path === path);
    if (existing) {
      selectProject(existing);
    } else {
      addProject(path);
    }
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

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((prev) => {
      const next = Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, prev + delta));
      saveNum(SIDEBAR_WIDTH_KEY, next);
      return next;
    });
  }, []);

  const handleToolPanelResize = useCallback((delta: number) => {
    setToolPanelWidth((prev) => {
      const next = Math.max(MIN_TOOLPANEL, Math.min(MAX_TOOLPANEL, prev + delta));
      saveNum(TOOLPANEL_WIDTH_KEY, next);
      return next;
    });
  }, []);

  const commands: CommandItem[] = useMemo(
    () => [
      { id: 'new-chat', label: '新建对话', shortcut: '⌘N', category: '对话', execute: handleNewChat },
      { id: 'toggle-sidebar', label: '切换侧栏', shortcut: '⌘B', category: '视图', execute: toggleSidebar },
      { id: 'toggle-panel', label: '切换工具面板', shortcut: '⌘⇧F', category: '视图', execute: toggleToolPanel },
      { id: 'toggle-theme', label: '切换主题', category: '外观', execute: toggleTheme },
      { id: 'open-project', label: '打开项目', shortcut: '⌘O', category: '项目', execute: handleOpenProject },
      { id: 'open-settings', label: '打开设置', shortcut: '⌘,', category: '偏好设置', execute: () => setSettingsOpen(true) },
      { id: 'clear-chat', label: '清空对话', category: '对话', execute: handleNewChat },
    ],
    [handleNewChat, toggleSidebar, toggleToolPanel, toggleTheme, handleOpenProject],
  );

  const actions = useMemo(
    () => ({
      onNewChat: handleNewChat,
      onToggleSidebar: toggleSidebar,
      onToggleToolPanel: toggleToolPanel,
      onOpenSettings: () => setSettingsOpen(true),
      onOpenProject: handleOpenProject,
      onCommandPalette: () => setCommandPaletteOpen(true),
      onStopGeneration: stopGeneration,
    }),
    [handleNewChat, toggleSidebar, toggleToolPanel, stopGeneration, handleOpenProject],
  );

  useKeyboardShortcuts(actions);

  // Show project selector when no project is open
  if (!activeProject) {
    return (
      <ThemeProvider>
        <ProjectSelector onProjectOpen={handleProjectOpen} />
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          commands={commands}
        />
      </ThemeProvider>
    );
  }

  return (
    <div className="appLayout">
      <div className="appBody">
        <SidebarToggle sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
        {sidebarOpen && (
          <>
            <Sidebar
              projectPath={projectPath}
              onNewChat={handleNewChat}
              onClose={toggleSidebar}
              onOpenSettings={() => setSettingsOpen(true)}
              onToggleTheme={toggleTheme}
              style={{ width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}
            />
            <ResizeHandle direction="left" onResize={handleSidebarResize} />
          </>
        )}
        <ChatView />
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

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={commands}
      />

      <SettingsDialog
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
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
