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

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 56), 200)}px`;
  }, [text]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    sendMessage(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '56px';
    }
  }, [canSend, text, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
          placeholder="输入消息…"
          spellCheck={false}
          rows={1}
        />
        <div className={styles.inputFooter}>
          <div className={styles.inputFooterLeft}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)', cursor: 'pointer' }}>attach_file</span>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)', cursor: 'pointer' }}>image</span>
          </div>
          <div className={styles.inputFooterRight}>
            {isGenerating ? (
              <button className={styles.stopBtn} onClick={stopGeneration}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>stop_circle</span>
                停止
              </button>
            ) : (
              <button
                className={`${styles.sendBtn} ${canSend ? styles.sendBtnActive : ''}`}
                onClick={handleSend}
                disabled={!canSend}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_upward</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { InputArea };
