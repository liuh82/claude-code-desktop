import { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { useKeyboardShortcuts } from '@/hooks/useKeyboard';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useChatStore } from '@/stores/useChatStore';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { ChatView } from '@/components/Chat/ChatView';
import { ToolPanel } from '@/components/ToolPanel/ToolPanel';
import { SidebarToggle, ToolPanelToggle } from '@/components/PanelToggles';
import { CommandPalette, type CommandItem } from '@/components/CommandPalette';
import { SettingsDialog } from '@/components/SettingsDialog';
import './App.css';

const SIDEBAR_KEY = 'ccdesk-sidebar-v2';
const TOOLPANEL_KEY = 'ccdesk-toolpanel-v2';

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === 'true') return true;
    if (v === 'false') return false;
  } catch { /* ignore */ }
  return fallback;
}

function AppContent() {
  const { toggleTheme } = useTheme();
  const { loadSettings } = useSettingsStore();
  const clearChat = useChatStore((s) => s.clearChat);
  const stopGeneration = useChatStore((s) => s.stopGeneration);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => readBool(SIDEBAR_KEY, true));
  const [toolPanelOpen, setToolPanelOpen] = useState(() => readBool(TOOLPANEL_KEY, true));
  const [projectPath] = useState('/workspace/claude-code-desktop');

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
  }, [clearChat]);

  const commands: CommandItem[] = useMemo(
    () => [
      { id: 'new-chat', label: 'New Chat', shortcut: '\u2318N', category: 'Chat', execute: handleNewChat },
      { id: 'toggle-sidebar', label: 'Toggle Sidebar', shortcut: '\u2318B', category: 'View', execute: toggleSidebar },
      { id: 'toggle-panel', label: 'Toggle Tool Panel', shortcut: '\u2318\u21E7F', category: 'View', execute: toggleToolPanel },
      { id: 'toggle-theme', label: 'Toggle Theme', category: 'Appearance', execute: toggleTheme },
      { id: 'open-settings', label: 'Open Settings', shortcut: '\u2318,', category: 'Preferences', execute: () => setSettingsOpen(true) },
      { id: 'clear-chat', label: 'Clear Chat', category: 'Chat', execute: handleNewChat },
    ],
    [handleNewChat, toggleSidebar, toggleToolPanel, toggleTheme],
  );

  const actions = useMemo(
    () => ({
      onNewChat: handleNewChat,
      onToggleSidebar: toggleSidebar,
      onToggleToolPanel: toggleToolPanel,
      onOpenSettings: () => setSettingsOpen(true),
      onCommandPalette: () => setCommandPaletteOpen(true),
      onStopGeneration: stopGeneration,
    }),
    [handleNewChat, toggleSidebar, toggleToolPanel, stopGeneration],
  );

  useKeyboardShortcuts(actions);

  return (
    <div className="appLayout">
      <div className="appBody">
        <SidebarToggle sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
        {sidebarOpen && (
          <Sidebar
            projectPath={projectPath}
            onNewChat={handleNewChat}
            onClose={toggleSidebar}
            onOpenSettings={() => setSettingsOpen(true)}
            onToggleTheme={toggleTheme}
          />
        )}
        <ChatView />
        {toolPanelOpen && (
          <ToolPanel onClose={toggleToolPanel} />
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
