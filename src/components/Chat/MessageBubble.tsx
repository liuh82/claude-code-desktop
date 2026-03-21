import type { ChatMessage } from '@/types/chat';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import styles from './MessageBubble.module.css';

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const avatar = isUser ? '\uD83D\uDC64' : '\uD83E\uDD16';
  const roleLabel = isUser ? 'You' : 'Assistant';
  const timeStr = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`${styles.message} ${isUser ? styles.messageUser : styles.messageAssistant}`}>
      <div className={styles.avatar}>{avatar}</div>
      <div className={styles.messageBody}>
        <div className={styles.messageMeta}>
          <span className={styles.messageRole}>{roleLabel}</span>
          <span className={styles.messageTime}>{timeStr}</span>
        </div>

        {isUser ? (
          <div className={styles.messageContent}>{message.content}</div>
        ) : (
          <>
            {message.content && (
              <div className={`${styles.messageContent} ${message.isStreaming ? styles.streamingCursor : ''}`}>
                <MarkdownRenderer content={message.content} />
              </div>
            )}
            {message.toolCalls && message.toolCalls.map((tc) => (
              <ToolCallBlock key={tc.id} toolCall={tc} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export { MessageBubble };
