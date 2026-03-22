import styles from './TopNav.module.css';

interface TopNavProps {
  projectName: string;
}

const MENUS = ['File', 'Edit', 'View', 'Terminal', 'Window'];

function TopNav({ projectName }: TopNavProps) {
  return (
    <header className={styles.topNav}>
      <div className={styles.topNavLeft}>
        <img src="/claude-icon-32.png" alt="Claude" className={styles.topNavLogoImg} />
        <nav className={styles.topNavMenus}>
          {MENUS.map((menu) => (
            <button key={menu} className={styles.topNavMenu}>{menu}</button>
          ))}
        </nav>
      </div>

      <div className={styles.topNavRight}>
        <div className={styles.topNavProject}>
          <span className={styles.topNavProjectIcon}>
            <span className="material-symbols-outlined">folder_open</span>
          </span>
          <span className={styles.topNavProjectName} title={projectName}>{projectName}</span>
        </div>
        <div className={styles.topNavActions}>
          <button className={`${styles.topNavAction} ${styles.topNavActionCta}`} title="Project Tree">
            <span className="material-symbols-outlined">account_tree</span>
          </button>
          <button className={`${styles.topNavAction} ${styles.topNavActionCta}`} title="Activity">
            <span className="material-symbols-outlined">monitoring</span>
          </button>
          <button className={`${styles.topNavAction} ${styles.topNavActionCta}`} title="Split View">
            <span className="material-symbols-outlined">splitscreen</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export { TopNav };
