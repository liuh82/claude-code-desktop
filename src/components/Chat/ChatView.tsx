import { useRef, useEffect, useCallback } from 'react';
import { useChatStore } from '@/stores/useChatStore';
import { MessageBubble } from './MessageBubble';
import { InputArea } from './InputArea';
import styles from './ChatView.module.css';

function ChatView() {
  const messages = useChatStore((s) => s.messages);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or content update
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
              <div className={styles.emptyIcon}>{'\uD83E\uDD16'}</div>
              <div className={styles.emptyTitle}>Claude Code Desktop</div>
              <div className={styles.emptyHint}>
                Start a conversation by typing a message below.
                Use / for commands or ask me anything about your code.
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
      <InputArea />
    </div>
  );
}

export { ChatView };
