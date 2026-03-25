import { useMemo } from 'react';
import type { ToolCall } from '@/types/chat';
import styles from './StreamingStatus.module.css';

interface StreamingStatusProps {
  toolCalls: ToolCall[];
  hasTextContent: boolean;
  textContent?: string;
}

function getToolIcon(name: string): string {
  if (name === 'ReadFile' || name === 'Read') return 'description';
  if (name === 'WriteFile' || name === 'Write') return 'edit_note';
  if (name === 'Edit') return 'edit';
  if (name === 'ExecuteCommand' || name === 'Bash' || name === 'Shell') return 'terminal';
  if (name === 'SearchFiles' || name === 'Grep') return 'search';
  if (name === 'Glob') return 'folder_open';
  return 'build';
}

function getToolAction(name: string): string {
  if (name === 'ReadFile' || name === 'Read') return 'Reading';
  if (name === 'WriteFile' || name === 'Write') return 'Writing';
  if (name === 'Edit') return 'Editing';
  if (name === 'ExecuteCommand' || name === 'Bash' || name === 'Shell') return 'Running';
  if (name === 'SearchFiles' || name === 'Grep') return 'Searching';
  if (name === 'Glob') return 'Finding files';
  return name;
}

function getTarget(input: Record<string, unknown>): string {
  if (input.file_path) return String(input.file_path);
  if (input.command) {
    const cmd = String(input.command);
    return cmd.length > 60 ? cmd.slice(0, 60) + '...' : cmd;
  }
  if (input.pattern) return String(input.pattern);
  if (input.query) return String(input.query);
  if (input.path) return String(input.path);
  return '';
}

function StatusLine({ toolCall }: { toolCall: ToolCall }) {
  const icon = getToolIcon(toolCall.name);
  const action = getToolAction(toolCall.name);
  const target = getTarget(toolCall.input);
  const isRunning = toolCall.status === 'running';
  const isCompleted = toolCall.status === 'completed';
  const isError = toolCall.status === 'error';

  return (
    <div className={`${styles.statusLine} ${isRunning ? styles.statusLineRunning : ''}`}>
      <span className={`${styles.statusIcon} ${isCompleted ? styles.statusIconDone : isError ? styles.statusIconError : ''}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </span>
      <span className={`${styles.statusText} ${isCompleted ? styles.statusTextDone : isError ? styles.statusTextError : ''}`}>
        {action}{target ? ` ${target}` : ''}
      </span>
      {isCompleted && (
        <span className={styles.statusBadge}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
        </span>
      )}
      {isError && (
        <span className={`${styles.statusBadge} ${styles.statusBadgeError}`}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
        </span>
      )}
      {isRunning && (
        <span className={styles.spinner}>
          <span className="material-symbols-outlined">progress_activity</span>
        </span>
      )}
    </div>
  );
}

function StreamingStatus({ toolCalls, hasTextContent, textContent }: StreamingStatusProps) {
  // Filter out pending_permission — those are shown as PermissionBlock separately
  const statusCalls = toolCalls.filter(
    (tc) => tc.status !== 'pending_permission'
  );

  // Show last non-empty line of text as a preview, capped at 80 chars
  const textPreview = useMemo(() => {
    if (!textContent) return '';
    const lines = textContent.split('\n').filter(Boolean);
    const last = lines[lines.length - 1];
    if (!last) return '';
    return last.length > 80 ? last.slice(0, 80) + '…' : last;
  }, [textContent]);

  return (
    <div className={styles.container}>
      {statusCalls.map((tc) => (
        <StatusLine key={tc.id} toolCall={tc} />
      ))}
      {hasTextContent && (
        <div className={`${styles.statusLine} ${styles.statusLineGenerating}`}>
          <span className={styles.statusIcon}>
            <span className="material-symbols-outlined">auto_awesome</span>
          </span>
          <span className={styles.generatingText}>
            {textPreview || '正在生成回复...'}
          </span>
          <span className={styles.spinner}>
            <span className="material-symbols-outlined">progress_activity</span>
          </span>
        </div>
      )}
    </div>
  );
}

export { StreamingStatus };
