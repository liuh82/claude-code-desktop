import { useState, useEffect, useRef, useCallback } from 'react';
import { claudeApi } from '@/lib/claude-api';
import styles from './LogViewer.module.css';

interface LogEntry {
  timestamp: number;
  level: string;
  source: string;
  message: string;
}

type FilterLevel = 'all' | 'info' | 'warn' | 'error' | 'debug';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function levelColor(level: string): string {
  switch (level) {
    case 'error': return 'var(--error, #ef4444)';
    case 'warn': return '#f59e0b';
    case 'debug': return 'var(--text-muted, #64748b)';
    default: return 'var(--text-secondary, #94a3b8)';
  }
}

interface LogViewerProps {
  onClose: () => void;
}

export function LogViewer({ onClose }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<FilterLevel>('all');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [count, setCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const fetchLogs = useCallback(async () => {
    try {
      const result = await claudeApi.getLogs({
        ...(filter !== 'all' ? { level: filter } : {}),
        ...(search ? { search } : {}),
      });
      setLogs(result as LogEntry[]);
      setCount(await claudeApi.getLogCount());
    } catch {}
  }, [filter, search]);

  // Initial fetch + periodic refresh
  useEffect(() => {
    fetchLogs();
    timerRef.current = setInterval(fetchLogs, 2000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchLogs]);

  // Auto-scroll on new logs
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleClear = async () => {
    await claudeApi.clearLogs();
    fetchLogs();
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(atBottom);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>terminal</span>
          <span className={styles.title}>日志查看器</span>
          <span className={styles.count}>{count} 条</span>
          <div style={{ flex: 1 }} />
          <div className={styles.filters}>
            {(['all', 'error', 'warn', 'info', 'debug'] as FilterLevel[]).map(l => (
              <button
                key={l}
                className={`${styles.filterBtn} ${filter === l ? styles.filterActive : ''}`}
                onClick={() => setFilter(l)}
              >
                {l === 'all' ? '全部' : l.toUpperCase()}
              </button>
            ))}
          </div>
          <div className={styles.searchWrap}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-muted)' }}>search</span>
            <input
              className={styles.search}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索日志..."
            />
          </div>
          <button className={styles.clearBtn} onClick={handleClear} title="清空日志">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_sweep</span>
          </button>
          <button className={styles.closeBtn} onClick={onClose} title="关闭">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        {/* Log content */}
        <div className={styles.content} ref={scrollRef} onScroll={handleScroll}>
          {logs.length === 0 ? (
            <div className={styles.empty}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, opacity: 0.3 }}>inbox</span>
              <span>暂无日志</span>
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={`${log.timestamp}-${i}`} className={`${styles.logLine} ${styles[`log${log.level}`] || ''}`}>
                <span className={styles.time}>{formatTime(log.timestamp)}</span>
                <span className={styles.level} style={{ color: levelColor(log.level) }}>
                  {log.level.toUpperCase().padEnd(5)}
                </span>
                <span className={styles.source}>[{log.source}]</span>
                <span className={styles.message}>{log.message}</span>
              </div>
            ))
          )}
          {!autoScroll && (
            <button className={styles.scrollBtn} onClick={() => {
              setAutoScroll(true);
              if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }}>
              ↓ 跳到最新
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
