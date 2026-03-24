import { useState, useCallback } from 'react';
import type { ToolCall } from '@/types/chat';
import styles from './ToolCallBlock.module.css';

interface ToolCallBlockProps {
  toolCall: ToolCall;
}

function getToolLabel(name: string): string {
  if (name === 'ReadFile' || name === 'Read') return 'READ';
  if (name === 'WriteFile' || name === 'Write') return 'WRITE';
  if (name === 'Edit') return 'EDIT';
  if (name === 'ExecuteCommand' || name === 'Bash' || name === 'Shell') return 'EXEC';
  if (name === 'SearchFiles' || name === 'Grep') return 'GREP';
  if (name === 'Glob') return 'GLOB';
  return name.toUpperCase().slice(0, 16);
}

function getShortSummary(toolCall: ToolCall): string {
  const input = toolCall.input;
  if (input.file_path) return String(input.file_path);
  if (input.command) return String(input.command);
  if (input.query) return String(input.query);
  if (input.pattern) return String(input.pattern);
  return '';
}

function getStatusIcon(status: ToolCall['status']): string {
  if (status === 'completed') return 'check_circle';
  if (status === 'running') return 'progress_activity';
  if (status === 'error') return 'error';
  if (status === 'pending_permission') return 'security';
  return 'list_alt';
}

function getStatusClass(status: ToolCall['status']): string {
  if (status === 'completed') return 'Completed';
  if (status === 'running') return 'Running';
  if (status === 'error') return 'Error';
  return 'Pending';
}

function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const label = getToolLabel(toolCall.name);
  const summary = getShortSummary(toolCall);
  const statusIcon = getStatusIcon(toolCall.status);
  const statusCls = getStatusClass(toolCall.status);

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const durationStr = toolCall.duration
    ? `${toolCall.duration < 1000 ? `${toolCall.duration}ms` : `${(toolCall.duration / 1000).toFixed(1)}s`}`
    : '';

  const statusText = toolCall.status === 'running'
    ? 'RUNNING'
    : toolCall.status === 'pending_permission'
    ? 'AWAITING APPROVAL'
    : toolCall.status === 'error'
    ? 'FAILED'
    : durationStr;

  const inputStr = JSON.stringify(toolCall.input, null, 2);

  return (
    <div>
      <div
        className={`${styles.toolCall} ${styles[`toolCall${statusCls}`]}`}
        onClick={toggleExpand}
      >
        <span className={`${styles.toolIcon} ${styles[`toolIcon${statusCls}`]}`}>
          <span className="material-symbols-outlined">{statusIcon}</span>
        </span>
        <span className={`${styles.toolName} ${styles[`toolName${statusCls}`]}`}>{label}</span>
        {summary && <span className={styles.toolPath}>{summary}</span>}
        <span className={`${styles.toolStatus} ${styles[`toolStatus${statusCls}`]}`}>
          {statusText}
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
