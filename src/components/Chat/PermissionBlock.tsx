import { useState } from 'react';
import styles from './PermissionBlock.module.css';

interface PermissionBlockProps {
  toolName: string;
  toolIcon: string;
  target: string;
  detail?: string;
  isDangerous?: boolean;
  onAllow: () => void;
  onAllowAlways?: () => void;
  onDeny: () => void;
}

type PermissionState = 'pending' | 'approved' | 'blocked';

function getActionLabel(toolName: string): string {
  if (toolName === 'EXEC' || toolName === 'Bash' || toolName === 'Shell') return 'Command Execution';
  if (toolName === 'WRITE' || toolName === 'Write' || toolName === 'Edit') return 'File Write Permission';
  if (toolName === 'READ' || toolName === 'Read') return 'File Read Permission';
  return `${toolName} Permission`;
}

function PermissionBlock({
  toolName,
  toolIcon,
  target,
  detail,
  isDangerous = false,
  onAllow,
  onAllowAlways,
  onDeny,
}: PermissionBlockProps) {
  const [state, setState] = useState<PermissionState>('pending');

  const handleAllow = () => {
    setState('approved');
    onAllow();
  };

  const handleDeny = () => {
    setState('blocked');
    onDeny();
  };

  // Approved state: compact running indicator
  if (state === 'approved') {
    return (
      <div className={styles.wrapper}>
        <div className={styles.approvedOverlay}>
          <span className="material-symbols-outlined">progress_activity</span>
          <span>{toolName}</span>
          <span style={{ opacity: 0.5 }}>{target}</span>
          <span style={{ marginLeft: 'auto', opacity: 0.5 }}>RUNNING</span>
        </div>
      </div>
    );
  }

  // Blocked state: red blocked indicator
  if (state === 'blocked') {
    return (
      <div className={styles.wrapper}>
        <div className={styles.blockedOverlay}>
          <span className="material-symbols-outlined">block</span>
          <span>{toolName}</span>
          <span style={{ opacity: 0.5 }}>{target}</span>
          <span className={styles.blockedTag}>BLOCKED</span>
        </div>
      </div>
    );
  }

  // Parse diff lines from detail
  const diffLines = detail ? detail.split('\n').slice(0, 10) : [];
  const hasMoreLines = detail && detail.split('\n').length > 10;

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.iconCircle}>
            <span className="material-symbols-outlined">{toolIcon}</span>
          </div>
          <div className={styles.headerText}>
            <div className={styles.title}>{getActionLabel(toolName)}</div>
            <div className={styles.description}>
              Claude is requesting permission to {toolName === 'EXEC' ? 'execute' : 'modify'}{' '}
              <span className={styles.target}>{target}</span>
            </div>
          </div>
        </div>

        {/* Diff preview */}
        {diffLines.length > 0 && (
          <div className={styles.diffPreview}>
            {diffLines.map((line, i) => {
              const isDel = line.startsWith('-');
              const isAdd = line.startsWith('+');
              const cls = isDel ? styles.diffDel : isAdd ? styles.diffAdd : '';
              return (
                <div key={i} className={`${styles.diffLine} ${cls}`}>
                  <span className={styles.diffLineNum}>{i + 1}</span>
                  <span className={styles.diffLineContent}>{line}</span>
                </div>
              );
            })}
            {hasMoreLines && (
              <div className={styles.diffShowMore}>Show more...</div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className={styles.buttons}>
          {isDangerous ? (
            <>
              <button className={styles.btnBlock} onClick={handleDeny}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>block</span>
                Block
              </button>
              <div className={styles.secondaryRow}>
                <button className={styles.btnSecondary} onClick={handleAllow}>
                  Allow Anyway
                </button>
                {onAllowAlways && (
                  <button className={styles.btnSecondary} onClick={onAllowAlways}>
                    Always Allow
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <button className={styles.btnAllow} onClick={handleAllow}>
                Allow
              </button>
              <div className={styles.secondaryRow}>
                {onAllowAlways && (
                  <button className={styles.btnSecondary} onClick={onAllowAlways}>
                    Allow Always
                  </button>
                )}
                <button className={`${styles.btnSecondary} ${styles.btnDeny}`} onClick={handleDeny}>
                  Deny
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export { PermissionBlock };
