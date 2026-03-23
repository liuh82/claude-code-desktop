import { useState, useEffect } from 'react';
import { claudeApi } from '@/lib/claude-api';
import styles from './HistoryDialog.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
}

interface Session {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export function HistoryDialog({ isOpen, onClose, onSelectSession }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    claudeApi.listSessions({ projectId: 'default' }).then((data: any) => {
      setSessions(data as Session[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
      if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
      return d.toLocaleDateString('zh-CN');
    } catch { return ''; }
  };

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
              key={s.id}
              className={styles.sessionItem}
              onClick={() => { onSelectSession(s.id); onClose(); }}
            >
              <div className={styles.sessionLeft}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 8, opacity: 0.5 }}>chat</span>
                <div>
                  <div className={styles.sessionTitle}>{s.title}</div>
                  <div className={styles.sessionMeta}>
                    {formatDate(s.updatedAt)} · {s.messageCount} 条消息
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
