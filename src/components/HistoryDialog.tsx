import { useState, useEffect } from 'react';
import { claudeApi } from '@/lib/claude-api';
import styles from './HistoryDialog.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  projectPath: string;
}

interface ClaudeSession {
  sessionId: string;
  preview: string;
  lastUsed: number;
  messageCount: number;
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  const d = new Date(ms);
  return d.toLocaleDateString('zh-CN');
}

export function HistoryDialog({ isOpen, onClose, onSelectSession, projectPath }: Props) {
  const [sessions, setSessions] = useState<ClaudeSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    claudeApi.listClaudeSessions({ projectPath }).then((data) => {
      setSessions(data);
      setLoading(false);
    }).catch(() => {
      setSessions([]);
      setLoading(false);
    });
  }, [isOpen, projectPath]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>历史记录</span>
          <button className={styles.closeBtn} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className={styles.body}>
          {loading && <div className={styles.empty}>加载中...</div>}
          {!loading && sessions.length === 0 && (
            <div className={styles.empty}>暂无历史记录</div>
          )}
          {!loading && sessions.map((s) => (
            <button
              key={s.sessionId}
              className={styles.sessionItem}
              onClick={() => { onSelectSession(s.sessionId); onClose(); }}
            >
              <div className={styles.sessionLeft}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 8, opacity: 0.5 }}>chat</span>
                <div>
                  <div className={styles.sessionTitle}>
                    {s.preview || '空会话'}
                  </div>
                  <div className={styles.sessionMeta}>
                    {formatRelativeTime(s.lastUsed)} · {s.messageCount} 条消息
                  </div>
                </div>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: 16, opacity: 0.3 }}>chevron_right</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
