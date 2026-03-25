import { useState, useCallback } from 'react';
import styles from './MessageActions.module.css';

interface MessageActionsProps {
  messageContent: string;
  messageId: string;
  isUserMessage: boolean;
  isGenerating?: boolean;
  onRegenerate?: (messageId: string) => void;
  onEditAndResend?: (messageId: string, newContent: string) => void;
}

function MessageActions({ messageContent, messageId, isUserMessage, isGenerating, onRegenerate, onEditAndResend }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(messageContent);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(messageContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS or denied permission
      const ta = document.createElement('textarea');
      ta.value = messageContent;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
      document.body.removeChild(ta);
    }
  }, [messageContent]);

  const handleRegenerate = useCallback(() => {
    if (isGenerating) return;
    onRegenerate?.(messageId);
  }, [messageId, onRegenerate, isGenerating]);

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
    if (isGenerating) return;
    setIsEditing(false);
    onEditAndResend?.(messageId, trimmed);
  }, [messageId, editText, onEditAndResend, isGenerating]);

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
          disabled={isGenerating}
          title="重新生成"
        >
          <span className="material-symbols-outlined">
            {isGenerating ? 'progress_activity' : 'refresh'}
          </span>
          <span>{isGenerating ? '重新生成中...' : '重新生成'}</span>
        </button>
      )}

      {/* Copy */}
      <button
        className={`${styles.actionBtn} ${copied ? styles.actionBtnCopied : ''}`}
        onClick={handleCopy}
        title="复制"
      >
        <span className="material-symbols-outlined">
          {copied ? 'check' : 'content_copy'}
        </span>
        <span>{copied ? '已复制' : '复制'}</span>
      </button>

      {/* Edit: show on user messages */}
      {isUserMessage && (
        <button
          className={styles.actionBtn}
          onClick={handleEdit}
          title="编辑"
        >
          <span className="material-symbols-outlined">edit</span>
          <span>编辑</span>
        </button>
      )}
    </div>
  );
}

export { MessageActions };
