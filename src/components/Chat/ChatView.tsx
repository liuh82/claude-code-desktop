import { useRef, useEffect, useCallback } from 'react';
import { useChatStore } from '@/stores/useChatStore';
import { MessageBubble } from './MessageBubble';
import { InputArea } from './InputArea';
import { StatusBar } from './StatusBar';
import styles from './ChatView.module.css';

function ChatView() {
  const messages = useChatStore((s) => s.messages);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <div className={styles.chatView}>
      <div className={styles.messageList} ref={listRef}>
        <div className={styles.messageListInner}>
          {messages.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyLogo}>CCDesk</div>
              <div className={styles.emptyHints}>
                <div className={styles.emptyHint}>
                  <kbd>@</kbd>
                  <span>Reference files</span>
                </div>
                <div className={styles.emptyHint}>
                  <kbd>/</kbd>
                  <span>View commands</span>
                </div>
                <div className={styles.emptyHint}>
                  <kbd>{'\u2318'}K</kbd>
                  <span>Command palette</span>
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <StatusBar />
      <InputArea />
    </div>
  );
}

export { ChatView };
