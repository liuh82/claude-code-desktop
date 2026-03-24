import type { ChatMessage, ToolCall } from '@/types/chat';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import { PermissionBlock } from './PermissionBlock';
import styles from './MessageBubble.module.css';

interface MessageBubbleProps {
  message: ChatMessage;
  onPermissionAllow?: (toolCall: ToolCall) => void;
  onPermissionDeny?: (toolCall: ToolCall) => void;
}

function getPermissionInfo(toolCall: ToolCall): { toolName: string; toolIcon: string; target: string; isDangerous?: boolean } {
  const name = toolCall.name;
  if (name === 'ReadFile' || name === 'Read') {
    return { toolName: 'READ', toolIcon: 'description', target: String(toolCall.input.file_path || '') };
  }
  if (name === 'WriteFile' || name === 'Write' || name === 'Edit') {
    return { toolName: 'WRITE', toolIcon: 'edit_note', target: String(toolCall.input.file_path || ''), isDangerous: false };
  }
  if (name === 'ExecuteCommand' || name === 'Bash' || name === 'Shell') {
    return { toolName: 'EXEC', toolIcon: 'terminal', target: String(toolCall.input.command || ''), isDangerous: true };
  }
  return { toolName: name.toUpperCase(), toolIcon: 'security', target: '', isDangerous: false };
}

function MessageBubble({ message, onPermissionAllow, onPermissionDeny }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const roleLabel = isUser ? '你' : 'Claude Code';
  const timeStr = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
    <div className={`${styles.message} ${isUser ? styles.messageUser : styles.messageAssistant}`}>
      {avatar}
      <div className={styles.messageBody}>
        <div className={styles.messageMeta}>
          <span className={styles.messageRole}>{roleLabel}</span>
          <span className={styles.messageTime}>{timeStr}</span>
        </div>

        {isUser ? (
          <div className={styles.messageContent}>{message.content}</div>
        ) : (
          <>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className={styles.toolCallList}>
                {message.toolCalls.map((tc) => {
                  if (tc.status === 'pending_permission') {
                    const info = getPermissionInfo(tc);
                    return (
                      <PermissionBlock
                        key={tc.id}
                        toolName={info.toolName}
                        toolIcon={info.toolIcon}
                        target={info.target}
                        isDangerous={info.isDangerous}
                        onAllow={() => onPermissionAllow?.(tc)}
                        onDeny={() => onPermissionDeny?.(tc)}
                      />
                    );
                  }
                  return <ToolCallBlock key={tc.id} toolCall={tc} />;
                })}
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
