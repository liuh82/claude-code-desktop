import { useState, useCallback } from 'react';
import styles from './MessageActions.module.css';

interface MessageActionsProps {
  messageContent: string;
  messageId: string;
  isUserMessage: boolean;
  onRegenerate?: (messageId: string) => void;
  onEditAndResend?: (messageId: string, newContent: string) => void;
}

function MessageActions({ messageContent, messageId, isUserMessage, onRegenerate, onEditAndResend }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(messageContent);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(messageContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [messageContent]);

  const handleRegenerate = useCallback(() => {
    if (isRegenerating) return;
    setIsRegenerating(true);
    onRegenerate?.(messageId);
  }, [messageId, onRegenerate, isRegenerating]);

  const handleEdit = useCallback(() => {
    setEditText(messageContent);
    setIsEditing(true);
  }, [messageContent]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSubmitEdit = useCallback(() => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setIsEditing(false);
    onEditAndResend?.(messageId, trimmed);
  }, [messageId, editText, onEditAndResend]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmitEdit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  }, [handleSubmitEdit, handleCancelEdit]);

  if (isEditing) {
    return (
      <div className={styles.editContainer}>
        <textarea
          className={styles.editTextarea}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleEditKeyDown}
          autoFocus
        />
        <button className={`${styles.editBtn} ${styles.editBtnPrimary}`} onClick={handleSubmitEdit} disabled={!editText.trim()}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
        </button>
        <button className={`${styles.editBtn} ${styles.editBtnSecondary}`} onClick={handleCancelEdit}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>
    );
  }

  return (
    <div className={styles.messageActions}>
      {/* Regenerate: show on AI messages */}
      {!isUserMessage && (
        <button
          className={styles.actionBtn}
          onClick={handleRegenerate}
          disabled={isRegenerating}
          title="Regenerate"
        >
          <span className="material-symbols-outlined">
            {isRegenerating ? 'progress_activity' : 'refresh'}
          </span>
          <span>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
        </button>
      )}

      {/* Copy */}
      <button
        className={`${styles.actionBtn} ${copied ? styles.actionBtnCopied : ''}`}
        onClick={handleCopy}
        title="Copy"
      >
        <span className="material-symbols-outlined">
          {copied ? 'check' : 'content_copy'}
        </span>
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>

      {/* Edit: show on user messages */}
      {isUserMessage && (
        <button
          className={styles.actionBtn}
          onClick={handleEdit}
          title="Edit"
        >
          <span className="material-symbols-outlined">edit</span>
          <span>Edit</span>
        </button>
      )}
    </div>
  );
}

export { MessageActions };
