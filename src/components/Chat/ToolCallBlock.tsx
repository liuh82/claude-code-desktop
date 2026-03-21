import { useState, useCallback } from 'react';
import type { ToolCall } from '@/types/chat';
import styles from './ToolCallBlock.module.css';

interface ToolCallBlockProps {
  toolCall: ToolCall;
}

function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const statusIcon = toolCall.status === 'running'
    ? '\u23F3'
    : toolCall.status === 'completed'
      ? '\u2705'
      : '\u274C';

  const statusClass = toolCall.status === 'running'
    ? styles.toolCallStatusRunning
    : toolCall.status === 'completed'
      ? styles.toolCallStatusCompleted
      : styles.toolCallStatusError;

  const summary = toolCall.status === 'running'
    ? 'Running...'
    : toolCall.status === 'completed'
      ? 'Completed'
      : 'Failed';

  const durationStr = toolCall.duration
    ? `${(toolCall.duration / 1000).toFixed(1)}s`
    : '';

  // Extract a short description from the tool input
  const inputStr = JSON.stringify(toolCall.input, null, 2);

  return (
    <div className={styles.toolCall}>
      <div className={styles.toolCallHeader} onClick={toggleExpand}>
        <span className={`${styles.toolCallStatus} ${statusClass}`}>{statusIcon}</span>
        <span className={styles.toolCallName}>{toolCall.name}</span>
        <span className={styles.toolCallSummary}>{summary}</span>
        {durationStr && <span className={styles.toolCallDuration}>{durationStr}</span>}
        <span className={`${styles.toolCallExpand} ${expanded ? styles.toolCallExpandOpen : ''}`}>
          {'\u25B6'}
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
