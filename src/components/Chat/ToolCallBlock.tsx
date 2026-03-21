import { useState, useCallback } from 'react';
import type { ToolCall } from '@/types/chat';
import styles from './ToolCallBlock.module.css';

interface ToolCallBlockProps {
  toolCall: ToolCall;
}

function getToolIcon(name: string): { icon: string; label: string } {
  if (name === 'ReadFile' || name === 'Read') return { icon: 'description', label: 'Read' };
  if (name === 'WriteFile' || name === 'Write' || name === 'Edit') return { icon: 'edit_note', label: 'Write' };
  if (name === 'ExecuteCommand' || name === 'Bash' || name === 'Shell') return { icon: 'code', label: 'Execute' };
  if (name === 'SearchFiles' || name === 'Grep' || name === 'Glob') return { icon: 'search', label: 'Search' };
  return { icon: 'extension', label: name };
}

function getShortSummary(toolCall: ToolCall): string {
  const input = toolCall.input;
  if (input.file_path) return String(input.file_path);
  if (input.command) return String(input.command);
  if (input.query) return String(input.query);
  if (input.pattern) return String(input.pattern);
  return '';
}

function getToolIconColor(name: string): string {
  if (name === 'ReadFile' || name === 'Read') return 'var(--accent)';
  if (name === 'WriteFile' || name === 'Write' || name === 'Edit') return 'var(--warning)';
  if (name === 'ExecuteCommand' || name === 'Bash' || name === 'Shell') return 'var(--success)';
  if (name === 'SearchFiles' || name === 'Grep' || name === 'Glob') return 'var(--accent)';
  return 'var(--text-muted)';
}

function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const { icon, label } = getToolIcon(toolCall.name);
  const summary = getShortSummary(toolCall);
  const iconColor = getToolIconColor(toolCall.name);

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const durationStr = toolCall.duration
    ? `${(toolCall.duration / 1000).toFixed(1)}s`
    : '';

  const statusBadge = toolCall.status === 'running' ? (
    <span className={`${styles.badge} ${styles.badgeRunning}`}>
      <span className={styles.spinner} />
      运行中
    </span>
  ) : toolCall.status === 'completed' ? (
    <span className={`${styles.badge} ${styles.badgeCompleted}`}>
      {durationStr}
    </span>
  ) : (
    <span className={`${styles.badge} ${styles.badgeError}`}>失败</span>
  );

  const inputStr = JSON.stringify(toolCall.input, null, 2);

  return (
    <div className={styles.toolCall}>
      <div className={styles.toolCallHeader} onClick={toggleExpand}>
        <span className={styles.toolIcon}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: iconColor }}>{icon}</span>
        </span>
        <span className={styles.toolLabel}>{label}</span>
        {summary && <span className={styles.toolSummary}>{summary}</span>}
        <span className={styles.toolStatusArea}>
          {statusBadge}
        </span>
        <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
        </span>
      </div>

      {expanded && (
        <div className={styles.toolCallBody}>
          <div className={styles.toolCallLabel}>输入</div>
          <div className={styles.toolCallContent}>{inputStr}</div>
          {toolCall.output && (
            <>
              <div className={styles.toolCallLabel} style={{ marginTop: 8 }}>输出</div>
              <div className={styles.toolCallContent}>{toolCall.output}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export { ToolCallBlock };
