import styles from './PanelToggles.module.css';

interface PanelTogglesProps {
  sidebarOpen: boolean;
  toolPanelOpen: boolean;
  onToggleSidebar: () => void;
  onToggleToolPanel: () => void;
}

function PanelToggles({ sidebarOpen, toolPanelOpen, onToggleSidebar, onToggleToolPanel }: PanelTogglesProps) {
  return (
    <>
      {!sidebarOpen && (
        <button
          className={`${styles.toggleBtn} ${styles.toggleLeft}`}
          onClick={onToggleSidebar}
          title="Open Sidebar (Cmd+B)"
          aria-label="Open sidebar"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="5" height="14" rx="1" opacity="0.3" />
            <rect x="8" y="1" width="7" height="14" rx="1" opacity="0.6" />
          </svg>
        </button>
      )}
      {!toolPanelOpen && (
        <button
          className={`${styles.toggleBtn} ${styles.toggleRight}`}
          onClick={onToggleToolPanel}
          title="Open Tool Panel (Cmd+Shift+F)"
          aria-label="Open tool panel"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="7" height="14" rx="1" opacity="0.6" />
            <rect x="10" y="1" width="5" height="14" rx="1" opacity="0.3" />
          </svg>
        </button>
      )}
    </>
  );
}

export { PanelToggles };
