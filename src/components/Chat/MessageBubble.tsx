import { useCallback, memo } from 'react';
import type { ChatMessage } from '@/types/chat';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import { StreamingStatus } from './StreamingStatus';
import { MessageActions } from './MessageActions';
import { useChatStore } from '@/stores/useChatStore';
import { getPermissionInfo } from '@/lib/tool-utils';
import styles from './MessageBubble.module.css';

interface MessageBubbleProps {
  message: ChatMessage;
  paneId: string;
}

const MessageBubble = memo(function MessageBubble({ message, paneId }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const roleLabel = isUser ? '你' : 'Claude Code';
  const timeStr = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const regenerateMessage = useChatStore((s) => s.regenerateMessage);
  const editAndResend = useChatStore((s) => s.editAndResend);

  const handleRegenerate = useCallback(() => {
    regenerateMessage(paneId, message.id);
  }, [paneId, message.id, regenerateMessage]);

  const handleEditAndResend = useCallback((newContent: string) => {
    editAndResend(paneId, message.id, newContent);
  }, [paneId, message.id, editAndResend]);

  const avatar = isUser ? (
    <div className={styles.userAvatar}>
      <span className="material-symbols-outlined">person</span>
    </div>
  ) : (
    <div className={styles.aiAvatar}>
      <span className="material-symbols-outlined">smart_toy</span>
    </div>
  );

  return (
    <div
      className={`${styles.message} ${isUser ? styles.messageUser : styles.messageAssistant}`}
    >
      {avatar}
      <div className={styles.messageBody}>
        <div className={styles.messageMeta}>
          <span className={styles.messageRole}>{roleLabel}</span>
          <span className={styles.messageTime}>{timeStr}</span>
        </div>

        {isUser ? (
          <div className={styles.messageContent}>{message.content}</div>
        ) : (
          <div className={styles.assistantBody}>
            <div className={styles.assistantContent}>
              {message.isStreaming ? (
                /* ── Streaming: show status indicators + permission blocks ── */
                <>
                  {(message.toolCalls && message.toolCalls.length > 0) && (
                    <div className={styles.toolCallList}>
                      {message.toolCalls.map((tc) => {
                        if (tc.status === 'pending_permission') {
                          const info = getPermissionInfo(tc);
                          return (
                            <div key={tc.id} className={styles.permissionPending}>
                              <span className="material-symbols-outlined">hourglass_top</span>
                              <span>{info.toolName}</span>
                              <span className={styles.permissionPendingLabel}>等待权限确认...</span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                  <StreamingStatus
                    toolCalls={message.toolCalls || []}
                    hasTextContent={!!message.content}
                    textContent={message.content}
                  />
                </>
              ) : (
                /* ── Completed: show full tool call cards + markdown ── */
                <>
                  {(message.toolCalls && message.toolCalls.length > 0) && (
                    <div className={styles.toolCallList}>
                      {message.toolCalls.map((tc) => {
                        if (tc.status === 'pending_permission') {
                          const info = getPermissionInfo(tc);
                          return (
                            <div key={tc.id} className={styles.permissionPending}>
                              <span className="material-symbols-outlined">hourglass_top</span>
                              <span>{info.toolName}</span>
                              <span className={styles.permissionPendingLabel}>等待权限确认...</span>
                            </div>
                          );
                        }
                        return <ToolCallBlock key={tc.id} toolCall={tc} />;
                      })}
                    </div>
                  )}
                  <div className={styles.messageContent}>
                    {message.content ? (
                      <MarkdownRenderer key={`md-${message.id}`} content={message.content} isStreaming={message.isStreaming} />
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Action buttons — show on hover (mobile: always visible) */}
        {!message.isStreaming && message.content && (
          <MessageActions
            messageContent={message.content}
            messageId={message.id}
            isUserMessage={isUser}
            onRegenerate={handleRegenerate}
            onEditAndResend={handleEditAndResend}
          />
        )}
      </div>
    </div>
  );
});

export { MessageBubble };
