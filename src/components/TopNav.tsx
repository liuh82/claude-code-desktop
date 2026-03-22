import styles from './TopNav.module.css';

interface TopNavProps {
  projectName: string;
}

const MENUS = ['File', 'Edit', 'View', 'Terminal', 'Window'];

function TopNav({ projectName }: TopNavProps) {
  return (
    <header className={styles.topNav}>
      <div className={styles.topNavLeft}>
        <span className={styles.topNavLogo}>Claude Code</span>
        <nav className={styles.topNavMenus}>
          {MENUS.map((menu) => (
            <button key={menu} className={styles.topNavMenu}>{menu}</button>
          ))}
        </nav>
      </div>

      <div className={styles.topNavRight}>
        <div className={styles.topNavProject}>
          <span className={`material-symbols-outlined ${styles.topNavProjectIcon}`}>folder_open</span>
          <span className={styles.topNavProjectName} title={projectName}>{projectName}</span>
        </div>
        <div className={styles.topNavActions}>
          <button className={`${styles.topNavAction} ${styles.topNavActionIndigo}`} title="Project Tree">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_tree</span>
          </button>
          <button className={`${styles.topNavAction} ${styles.topNavActionEmerald}`} title="Activity">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>monitoring</span>
          </button>
          <button className={`${styles.topNavAction} ${styles.topNavActionAmber}`} title="Split View">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>splitscreen</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export { TopNav };
