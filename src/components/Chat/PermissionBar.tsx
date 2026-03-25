import { useState, useRef, useCallback } from 'react';
import styles from './PermissionBar.module.css';

interface PermissionBarProps {
  toolName: string;
  toolIcon: string;
  target: string;
  detail?: string;
  isDangerous?: boolean;
  onAllow: () => void;
  onAllowAlways?: () => void;
  onDeny: () => void;
}

function getActionVerb(toolName: string): string {
  if (toolName === 'EXEC') return '执行';
  return '修改';
}

function PermissionBar({
  toolName,
  toolIcon,
  target,
  detail,
  isDangerous = false,
  onAllow,
  onAllowAlways,
  onDeny,
}: PermissionBarProps) {
  const [diffExpanded, setDiffExpanded] = useState(false);
  const busyRef = useRef(false);

  // M1: compute split once
  const allLines = detail ? detail.split('\n') : [];
  const diffLines = allLines.slice(0, 20);
  const hasMoreLines = allLines.length > 20;

  // M2: guard against rapid double-click
  const guarded = useCallback((fn: () => void) => {
    return () => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        fn();
      } finally {
        // Reset after microtask so async handlers have time to clear permission
        queueMicrotask(() => { busyRef.current = false; });
      }
    };
  }, []);

  return (
    <div className={`${styles.bar} ${isDangerous ? styles.barDangerous : ''}`}>
      <div className={styles.barContent}>
        {/* Left: icon + description */}
        <div className={styles.barLeft}>
          <span className={`material-symbols-outlined ${styles.barIcon}`}>{toolIcon}</span>
          <span className={styles.barText}>
            允许 Claude {getActionVerb(toolName)}：
            <code className={styles.barTarget}>{target}</code>
          </span>
        </div>

        {/* Right: action buttons */}
        <div className={styles.barButtons}>
          {isDangerous ? (
            <>
              <button className={styles.btnBlock} onClick={guarded(onDeny)}>阻止</button>
              <button className={styles.btnMuted} onClick={guarded(onAllow)}>仍然允许</button>
            </>
          ) : (
            <>
              <button className={styles.btnAllow} onClick={guarded(onAllow)}>允许</button>
              <button className={styles.btnMuted} onClick={guarded(onDeny)}>拒绝</button>
              {onAllowAlways && (
                <button className={styles.btnMuted} onClick={guarded(onAllowAlways)}>始终允许</button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Expandable diff preview */}
      {diffLines.length > 0 && (
        <div className={styles.diffSection}>
          <button
            className={styles.diffToggle}
            onClick={() => setDiffExpanded(prev => !prev)}
          >
            <span className={`material-symbols-outlined ${styles.diffToggleIcon}`}>
              {diffExpanded ? 'expand_less' : 'expand_more'}
            </span>
            查看变更
          </button>
          {diffExpanded && (
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
                <div className={styles.diffShowMore}>仅显示前 20 行...</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { PermissionBar };
