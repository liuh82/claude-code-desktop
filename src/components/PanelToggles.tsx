import styles from './PanelToggles.module.css';


export function SidebarToggle({ sidebarOpen, onToggleSidebar }: { sidebarOpen: boolean; onToggleSidebar: () => void }) {
  if (sidebarOpen) return null;
  return (
    <button
      className={`${styles.toggleBtn} ${styles.toggleLeft}`}
      onClick={onToggleSidebar}
      title="打开侧栏 (⌘B)"
      aria-label="打开侧栏"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="5" height="14" rx="1" opacity="0.3" />
        <rect x="8" y="1" width="7" height="14" rx="1" opacity="0.6" />
      </svg>
    </button>
  );
}

export function ToolPanelToggle({ toolPanelOpen, onToggleToolPanel }: { toolPanelOpen: boolean; onToggleToolPanel: () => void }) {
  if (toolPanelOpen) return null;
  return (
    <button
      className={`${styles.toggleBtn} ${styles.toggleRight}`}
      onClick={onToggleToolPanel}
      title="打开工具面板 (⌘⇧F)"
      aria-label="打开工具面板"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="7" height="14" rx="1" opacity="0.6" />
        <rect x="10" y="1" width="5" height="14" rx="1" opacity="0.3" />
      </svg>
    </button>
  );
}
