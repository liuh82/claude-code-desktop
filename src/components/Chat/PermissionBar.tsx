import { useState } from 'react';
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

  const diffLines = detail ? detail.split('\n').slice(0, 20) : [];
  const hasMoreLines = detail ? detail.split('\n').length > 20 : false;

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
              <button className={styles.btnBlock} onClick={onDeny}>阻止</button>
              <button className={styles.btnMuted} onClick={onAllow}>仍然允许</button>
            </>
          ) : (
            <>
              <button className={styles.btnAllow} onClick={onAllow}>允许</button>
              <button className={styles.btnMuted} onClick={onDeny}>拒绝</button>
              {onAllowAlways && (
                <button className={styles.btnSecondary} onClick={onAllowAlways}>始终允许</button>
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
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
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
