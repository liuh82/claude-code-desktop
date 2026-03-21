import { useState, useCallback } from 'react';
import type { ToolCall } from '@/types/chat';
import styles from './ToolCallBlock.module.css';

interface ToolCallBlockProps {
  toolCall: ToolCall;
}

function getToolIcon(name: string): { icon: string; label: string } {
  if (name === 'ReadFile' || name === 'Read') return { icon: 'read', label: 'Read' };
  if (name === 'WriteFile' || name === 'Write' || name === 'Edit') return { icon: 'write', label: 'Write' };
  if (name === 'ExecuteCommand' || name === 'Bash' || name === 'Shell') return { icon: 'exec', label: 'Execute' };
  if (name === 'SearchFiles' || name === 'Grep' || name === 'Glob') return { icon: 'search', label: 'Search' };
  return { icon: 'tool', label: name };
}

function getShortSummary(toolCall: ToolCall): string {
  const input = toolCall.input;
  if (input.file_path) return String(input.file_path);
  if (input.command) return String(input.command);
  if (input.query) return String(input.query);
  if (input.pattern) return String(input.pattern);
  return '';
}

function ToolSvgIcon({ type }: { type: string }) {
  switch (type) {
    case 'read':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--info)" strokeWidth="1.2">
          <path d="M2 2h7l3 3v9H2V2z" />
          <polyline points="9,2 9,5 12,5" />
          <line x1="5" y1="8" x2="9" y2="8" />
          <line x1="5" y1="10" x2="8" y2="10" />
        </svg>
      );
    case 'write':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--warning)" strokeWidth="1.2">
          <path d="M11 2l3 3-9 9H2v-3L11 2z" />
          <line x1="9" y1="4" x2="12" y2="7" />
        </svg>
      );
    case 'exec':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--success)" strokeWidth="1.2">
          <polyline points="4,3 1,8 4,13" />
          <polyline points="12,3 15,8 12,13" />
          <line x1="10" y1="2" x2="6" y2="14" />
        </svg>
      );
    case 'search':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.2">
          <circle cx="7" cy="7" r="4" />
          <line x1="10" y1="10" x2="14" y2="14" />
        </svg>
      );
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-muted)" strokeWidth="1.2">
          <path d="M8 1l2 4 4.5.7-3.3 3.1.8 4.5L8 11.3 3.9 13.3l.8-4.5L1.5 5.7 6 5z" />
        </svg>
      );
  }
}

function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const { icon, label } = getToolIcon(toolCall.name);
  const summary = getShortSummary(toolCall);

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const durationStr = toolCall.duration
    ? `${(toolCall.duration / 1000).toFixed(1)}s`
    : '';

  const statusBadge = toolCall.status === 'running' ? (
    <span className={`${styles.badge} ${styles.badgeRunning}`}>
      <span className={styles.spinner} />
      Running
    </span>
  ) : toolCall.status === 'completed' ? (
    <span className={`${styles.badge} ${styles.badgeCompleted}`}>
      {durationStr}
    </span>
  ) : (
    <span className={`${styles.badge} ${styles.badgeError}`}>Failed</span>
  );

  const inputStr = JSON.stringify(toolCall.input, null, 2);

  return (
    <div className={styles.toolCall}>
      <div className={styles.toolCallHeader} onClick={toggleExpand}>
        <span className={styles.toolIcon}><ToolSvgIcon type={icon} /></span>
        <span className={styles.toolLabel}>{label}</span>
        {summary && <span className={styles.toolSummary}>{summary}</span>}
        <span className={styles.toolStatusArea}>
          {statusBadge}
        </span>
        <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <path d="M2 1l4 3-4 3z" />
          </svg>
        </span>
      </div>

      {expanded && (
        <div className={styles.toolCallBody}>
          <div className={styles.toolCallLabel}>Input</div>
          <div className={styles.toolCallContent}>{inputStr}</div>
          {toolCall.output && (
            <>
              <div className={styles.toolCallLabel} style={{ marginTop: 8 }}>Output</div>
              <div className={styles.toolCallContent}>{toolCall.output}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export { ToolCallBlock };
