import { useChatStore } from '@/stores/useChatStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { isElectron } from '@/lib/claude-api';
import styles from './StatusBar.module.css';

const CONTEXT_WINDOW = 200000;

function StatusBar() {
  const tokenUsage = useChatStore((s) => s.tokenUsage);
  const currentModel = useChatStore((s) => s.currentModel);
  const { settings } = useSettingsStore();

  const total = tokenUsage.input + tokenUsage.output;
  const percent = Math.min((total / CONTEXT_WINDOW) * 100, 100);

  const progressColor = percent < 60
    ? styles.progressGreen
    : percent < 80
      ? styles.progressYellow
      : styles.progressRed;

  const formatNumber = (n: number): string =>
    n.toLocaleString();

  const displayModel = currentModel || settings.defaultModel || 'unknown';

  return (
    <div className={styles.statusBar}>
      <div className={styles.statusLeft}>
        <span style={{ fontSize: 8 }}>{isElectron() ? '🟢' : '🟡'}</span>
        <span className={styles.modelName}>{displayModel}</span>
        <span className={styles.separator}>{'\u00B7'}</span>
        <span className={styles.tokenText}>
          {formatNumber(tokenUsage.input)} / {formatNumber(tokenUsage.output)} tokens
        </span>
      </div>
      <div className={styles.statusRight}>
        <div className={styles.progressTrack}>
          <div
            className={`${styles.progressFill} ${progressColor}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className={styles.progressText}>{percent.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export { StatusBar };
