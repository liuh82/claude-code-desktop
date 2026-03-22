import type { ChatMessage } from '@/types/chat';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import styles from './MessageBubble.module.css';

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const roleLabel = isUser ? 'You' : 'Assistant';
  const timeStr = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const avatar = isUser ? (
    <div className={styles.userAvatar}>
      <span className="material-symbols-outlined">person</span>
    </div>
  ) : (
    <div className={styles.aiAvatar}>
      <img src="/claude-icon-32.png" alt="Claude" />
    </div>
  );

  return (
    <div className={`${styles.message} ${isUser ? styles.messageUser : styles.messageAssistant}`}>
      {avatar}
      <div className={styles.messageBody}>
        <div className={styles.messageMeta}>
          <span className={styles.messageRole}>{roleLabel}</span>
          <span className={styles.messageTime}>{timeStr}</span>
        </div>

        {isUser ? (
          <div className={styles.userBubble}>
            <div className={styles.messageContent}>{message.content}</div>
          </div>
        ) : (
          <>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className={styles.toolCallList}>
                {message.toolCalls.map((tc) => (
                  <ToolCallBlock key={tc.id} toolCall={tc} />
                ))}
              </div>
            )}
            {message.content && (
              <div className={`${styles.messageContent} ${message.isStreaming ? styles.streamingCursor : ''}`}>
                <MarkdownRenderer content={message.content} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export { MessageBubble };
