import { useState, useRef, useCallback, useEffect } from 'react';
import { useChatStore } from '@/stores/useChatStore';
import styles from './InputArea.module.css';

function InputArea() {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopGeneration = useChatStore((s) => s.stopGeneration);

  const canSend = text.trim().length > 0 && !isGenerating;

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 60), 200)}px`;
  }, [text]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    sendMessage(text.trim());
    setText('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '60px';
    }
  }, [canSend, text, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Enter sends, Shift+Enter inserts newline
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className={styles.inputArea}>
      <div className={styles.inputWrapper}>
        <textarea
          ref={textareaRef}
          className={styles.inputTextarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... / for commands..."
          spellCheck={false}
          rows={1}
        />
        <div className={styles.inputFooter}>
          <div className={styles.inputFooterLeft}>
            <span className={styles.inputHint}>Shift+Enter for new line</span>
          </div>
          <div className={styles.inputFooterRight}>
            {isGenerating ? (
              <button className={styles.stopBtn} onClick={stopGeneration}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3" y="3" width="10" height="10" rx="1" />
                </svg>
                停止
              </button>
            ) : (
              <button
                className={`${styles.sendBtn} ${canSend ? styles.sendBtnActive : ''}`}
                onClick={handleSend}
                disabled={!canSend}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 8l12-6-3 6 3 6z" />
                </svg>
                发送
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { InputArea };
