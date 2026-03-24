import { useState, useCallback } from 'react';
import type { ToolCall } from '@/types/chat';
import styles from './ToolCallBlock.module.css';

interface ToolCallBlockProps {
  toolCall: ToolCall;
}

function getToolIconClass(name: string): string {
  if (name === 'ReadFile' || name === 'Read') return 'toolIconRead';
  if (name === 'WriteFile' || name === 'Write' || name === 'Edit') return 'toolIconWrite';
  if (name === 'ExecuteCommand' || name === 'Bash' || name === 'Shell') return 'toolIconExec';
  if (name === 'SearchFiles' || name === 'Grep' || name === 'Glob') return 'toolIconSearch';
  return 'toolIconDefault';
}

function getToolIcon(name: string): { icon: string; label: string } {
  if (name === 'ReadFile' || name === 'Read') return { icon: 'description', label: '读取' };
  if (name === 'WriteFile' || name === 'Write' || name === 'Edit') return { icon: 'edit_note', label: '写入' };
  if (name === 'ExecuteCommand' || name === 'Bash' || name === 'Shell') return { icon: 'code', label: '执行' };
  if (name === 'SearchFiles' || name === 'Grep' || name === 'Glob') return { icon: 'search', label: '搜索' };
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

function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const { icon, label } = getToolIcon(toolCall.name);
  const summary = getShortSummary(toolCall);
  const iconClass = getToolIconClass(toolCall.name);

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
      <span className={`${styles.badgeIcon} ${styles.badgeIconSuccess}`}>check_circle</span>
      {durationStr}
    </span>
  ) : (
    <span className={`${styles.badge} ${styles.badgeError}`}>
      <span className={`${styles.badgeIcon} ${styles.badgeIconError}`}>error</span>
      失败
    </span>
  );

  const inputStr = JSON.stringify(toolCall.input, null, 2);

  return (
    <div className={`${styles.toolCall} ${toolCall.status === 'running' ? styles.toolCallRunning : ''}`}>
      <div className={styles.toolCallHeader} onClick={toggleExpand}>
        <span className={`${styles.toolIcon} ${styles[iconClass]}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </span>
        <span className={styles.toolLabel}>{label}</span>
        {summary && <span className={styles.toolSummary}>{summary}</span>}
        <span className={styles.toolStatusArea}>
          {statusBadge}
        </span>
        <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}>
          <span className="material-symbols-outlined">chevron_right</span>
        </span>
      </div>

      {expanded && (
        <div className={styles.toolCallBody}>
          <div className={styles.toolCallLabel}>输入</div>
          <div className={styles.toolCallContent}>{inputStr}</div>
          {toolCall.output && (
            <>
              <div className={`${styles.toolCallLabel} ${styles.toolCallLabelOutput}`}>输出</div>
              <div className={styles.toolCallContent}>{toolCall.output}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export { ToolCallBlock };
