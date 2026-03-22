import { useChatStore } from '@/stores/useChatStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import styles from './StatusBar.module.css';


function StatusBar() {
  const tokenUsage = useChatStore((s) => s.tokenUsage);
  const { settings } = useSettingsStore();
  const total = tokenUsage.input + tokenUsage.output;
  const modelLabel = (useChatStore((s) => s.currentModel) || settings.defaultModel || '').replace('claude-', '').replace(/-\d{8}$/, '');
  const formatNumber = (n: number): string => n.toLocaleString();

  return (
    <div className={styles.statusBar}>
      <div className={styles.statusLeft}>
        <div className={`${styles.statusGroup} ${styles.statusGroupBorder}`} title="Git branch">
          <span className={styles.statusGroupIcon} style={{ color: '#6366f1' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>account_tree</span>
          </span>
          <span className={styles.branchName}>main*</span>
        </div>

        <div className={`${styles.statusGroup} ${styles.statusGroupBorder}`} title="Problems">
          <span className={styles.statusGroupIcon} style={{ color: 'var(--error)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>sync_problem</span>
          </span>
          <span className={styles.errorCount}>0</span>
        </div>

        <div className={styles.statusGroup} title="Connection status">
          <span className={styles.statusDot} />
          <span className={styles.statusLabel}>Ready</span>
        </div>
      </div>

      <div className={styles.statusRight}>
        <div className={styles.tokenGroup} title="Token usage">
          <span className={styles.tokenLabel}>Token: </span>
          <span className={styles.tokenValue}>{formatNumber(total)}</span>
          <span className={styles.tokenLabel}> / 128k</span>
        </div>

        <div className={`${styles.statusMeta} ${styles.encodingMeta}`} title="Encoding">UTF-8</div>

        <div className={`${styles.statusMeta} ${styles.langMeta}`} title="Language">
          {modelLabel || 'TypeScript'}
        </div>

        <button className={styles.notificationBtn} title="Notifications">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>notifications</span>
        </button>
      </div>
    </div>
  );
}

export { StatusBar };
