import { useMemo } from 'react';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { useKeyboardShortcuts } from '@/hooks/useKeyboard';
import StatusBar from '@/components/StatusBar';
import SplitPane from '@/components/SplitPane';
import TerminalView from '@/components/TerminalView';
import './App.css';

function AppContent() {
  const { toggleTheme } = useTheme();
  const tabArray = useMemo(() => Array.from({ length: 3 }), []);

  const actions = useMemo(
    () => ({
      onNewTab: () => {},
      onCloseTab: () => {},
      onSwitchTab: () => {},
      onSplitPane: () => {},
      onTogglePaneFocus: () => {},
      onCommandPalette: () => {},
    }),
    [],
  );

  useKeyboardShortcuts(actions);

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="app-sidebar__logo">
          <span className="app-sidebar__icon">CC</span>
        </div>
      </aside>

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
          onOpenSettings={() => {}}
        />
      </div>
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
