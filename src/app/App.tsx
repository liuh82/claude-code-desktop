import { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { useKeyboardShortcuts } from '@/hooks/useKeyboard';
import { useSettingsStore } from '@/stores/useSettingsStore';
import StatusBar from '@/components/StatusBar';
import SplitPane from '@/components/SplitPane';
import TerminalView from '@/components/TerminalView';
import { CommandPalette, type CommandItem } from '@/components/CommandPalette';
import { SettingsDialog } from '@/components/SettingsDialog';
import { ProjectManager } from '@/components/ProjectManager';
import { SessionList } from '@/components/SessionList';
import type { Project } from '@/types/tauri';
import './App.css';

function AppContent() {
  const { toggleTheme } = useTheme();
  const { loadSettings, updateSetting, settings } = useSettingsStore();
  const tabArray = useMemo(() => Array.from({ length: 3 }), []);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Sync theme from settings store
  useEffect(() => {
    if (settings.theme === 'dark' || settings.theme === 'light') {
      updateSetting('theme', settings.theme);
    }
  }, [settings.theme, updateSetting]);

  const handleOpenProject = useCallback((project: Project) => {
    setActiveProjectId(project.id);
  }, []);

  const handleSessionClick = useCallback((_session: import('@/types/session').Session) => {
    // TODO: focus pane with this session
  }, []);

  const commands: CommandItem[] = useMemo(
    () => [
      { id: 'new-tab', label: 'New Tab', shortcut: '\u2318N', category: 'File', execute: () => {} },
      { id: 'close-tab', label: 'Close Tab', shortcut: '\u2318W', category: 'File', execute: () => {} },
      { id: 'split-right', label: 'Split Pane Right', shortcut: '\u2318\\', category: 'View', execute: () => {} },
      { id: 'split-down', label: 'Split Pane Down', category: 'View', execute: () => {} },
      { id: 'toggle-theme', label: 'Toggle Theme', category: 'Appearance', execute: toggleTheme },
      { id: 'open-project', label: 'Open Project', category: 'File', execute: () => setSidebarOpen(true) },
      { id: 'open-settings', label: 'Open Settings', shortcut: '\u2318,', category: 'Preferences', execute: () => setSettingsOpen(true) },
    ],
    [toggleTheme],
  );

  const actions = useMemo(
    () => ({
      onNewTab: () => {},
      onCloseTab: () => {},
      onSwitchTab: () => {},
      onSplitPane: () => {},
      onTogglePaneFocus: () => {},
      onCommandPalette: () => setCommandPaletteOpen(true),
    }),
    [],
  );

  useKeyboardShortcuts(actions);

  return (
    <div className="app-layout">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="app-sidebar">
          <div className="app-sidebar__logo">
            <span className="app-sidebar__icon">CC</span>
          </div>
          <div className="app-sidebar__body">
            <ProjectManager
              onOpenProject={handleOpenProject}
              onRefresh={() => {}}
            />
          </div>
          {activeProjectId && (
            <div className="app-sidebar__sessions">
              <SessionList
                projectId={activeProjectId}
                onSessionClick={handleSessionClick}
              />
            </div>
          )}
          <button
            className="app-sidebar__close"
            onClick={() => setSidebarOpen(false)}
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            &#9664;
          </button>
        </aside>
      )}

      {/* Main content */}
      <div className="app-main">
        <div className="app-content">
          <SplitPane direction="horizontal" initialSizes={[50, 50]}>
            {tabArray.map((_, i) => (
              <TerminalView
                key={i}
                paneId={`pane-${i}`}
                onSendInput={() => {}}
              />
            ))}
          </SplitPane>
        </div>

        {/* Status bar */}
        <StatusBar
          sessionStatus="idle"
          modelName="Claude Sonnet 4.6"
          projectPath="/workspace/project"
          connected={true}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={commands}
      />

      {/* Settings Dialog */}
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
