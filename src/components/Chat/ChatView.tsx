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
              <div className={styles.emptyLogo}>
                <span className="material-symbols-outlined" style={{ fontSize: 36, color: "var(--brand-orange)" }}>terminal</span>
              </div>
              <div>
                <div className={styles.emptyTitle}>Claude Code</div>
                <div className={styles.emptySubtitle}>
                  AI 驱动的终端工作空间，开始对话探索你的项目
                </div>
              </div>
              <div className={styles.emptyHints}>
                <div className={styles.emptyHint}>
                  <kbd>@</kbd>
                  <span>引用文件</span>
                </div>
                <div className={styles.emptyHint}>
                  <kbd>/</kbd>
                  <span>查看命令</span>
                </div>
                <div className={styles.emptyHint}>
                  <kbd>{'\u2318'}K</kbd>
                  <span>命令面板</span>
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
