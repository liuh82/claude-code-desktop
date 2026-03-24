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
      <span className="material-symbols-outlined">menu</span>
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
      <span className="material-symbols-outlined">dock_to_right</span>
    </button>
  );
}
