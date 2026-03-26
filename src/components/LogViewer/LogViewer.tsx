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
type ViewMode = 'realtime' | 'history';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0') + ':' +
    String(d.getSeconds()).padStart(2, '0');
}

function levelColor(level: string): string {
  switch (level) {
    case 'error': return 'var(--error, #ef4444)';
    case 'warn': return '#f59e0b';
    case 'debug': return 'var(--text-muted, #64748b)';
    default: return 'var(--text-secondary, #94a3b8)';
  }
}

function dayRange(days: number): { since: number; until: number } {
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 0, 0, 0, 0);
  return { since: since.getTime(), until: now.getTime() };
}

interface LogViewerProps {
  onClose: () => void;
}

export function LogViewer({ onClose }: LogViewerProps) {
  const [mode, setMode] = useState<ViewMode>('realtime');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<FilterLevel>('all');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [count, setCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // History state
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [quickRange, setQuickRange] = useState<string>('7d');
  const [customSince, setCustomSince] = useState('');
  const [customUntil, setCustomUntil] = useState('');

  // Realtime fetch
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

  // History fetch
  const fetchHistoryLogs = useCallback(async (offset = 0) => {
    setHistoryLoading(true);
    try {
      let since: number | undefined;
      let until: number | undefined;

      if (quickRange === 'custom' && customSince) {
        since = new Date(customSince).getTime();
      } else {
        const days = quickRange === 'today' ? 0 : quickRange === 'yesterday' ? 1 : quickRange === '3d' ? 2 : 6;
        const range = dayRange(days);
        since = range.since;
        until = range.until;
      }
      if (customUntil) {
        until = new Date(customUntil).getTime();
      }

      const result = await claudeApi.getHistoryLogs({
        ...(since != null ? { since } : {}),
        ...(until != null ? { until } : {}),
        ...(filter !== 'all' ? { level: filter } : {}),
        ...(search ? { search } : {}),
        offset,
        limit: 200,
      });
      setLogs(result.logs as LogEntry[]);
      setHistoryTotal(result.total);
      setHistoryOffset(offset);
    } catch {}
    setHistoryLoading(false);
  }, [filter, search, quickRange, customSince, customUntil]);

  // Initial fetch + periodic refresh (realtime only)
  useEffect(() => {
    if (mode === 'realtime') {
      fetchLogs();
      timerRef.current = setInterval(fetchLogs, 2000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setHistoryOffset(0);
      fetchHistoryLogs(0);
    }
  }, [mode, fetchLogs, fetchHistoryLogs]);

  // Auto-scroll on new logs (realtime only)
  useEffect(() => {
    if (mode === 'realtime' && autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll, mode]);

  const handleClear = async () => {
    await claudeApi.clearLogs();
    if (mode === 'realtime') fetchLogs();
  };

  const handleExport = async () => {
    try {
      let since: number | undefined;
      let until: number | undefined;
      if (quickRange === 'custom' && customSince) {
        since = new Date(customSince).getTime();
      } else {
        const days = quickRange === 'today' ? 0 : quickRange === 'yesterday' ? 1 : quickRange === '3d' ? 2 : 6;
        const range = dayRange(days);
        since = range.since;
        until = range.until;
      }
      if (customUntil) {
        until = new Date(customUntil).getTime();
      }
      const path = await claudeApi.exportLogs({
        ...(since != null ? { since } : {}),
        ...(until != null ? { until } : {}),
        ...(filter !== 'all' ? { level: filter } : {}),
        ...(search ? { search } : {}),
      });
      if (path) {
        setCount(c => c); // trigger re-render
      }
    } catch {}
  };

  const handleLoadMore = () => {
    fetchHistoryLogs(historyOffset + 200);
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(atBottom);
  };

  const handleQuickRange = (range: string) => {
    setQuickRange(range);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>terminal</span>
          <span className={styles.title}>日志查看器</span>
          <span className={styles.count}>{mode === 'realtime' ? count : historyTotal} 条</span>

          {/* Mode toggle */}
          <div className={styles.modeToggle}>
            <button
              className={`${styles.modeBtn} ${mode === 'realtime' ? styles.modeActive : ''}`}
              onClick={() => setMode('realtime')}
            >
              实时
            </button>
            <button
              className={`${styles.modeBtn} ${mode === 'history' ? styles.modeActive : ''}`}
              onClick={() => setMode('history')}
            >
              历史
            </button>
          </div>

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
          {mode === 'history' && (
            <button className={styles.exportBtn} onClick={handleExport} title="导出日志">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            </button>
          )}
          <button className={styles.clearBtn} onClick={handleClear} title="清空日志">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_sweep</span>
          </button>
          <button className={styles.closeBtn} onClick={onClose} title="关闭">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        {/* History date range picker */}
        {mode === 'history' && (
          <div className={styles.dateBar}>
            <div className={styles.quickDates}>
              {[
                { key: 'today', label: '今天' },
                { key: 'yesterday', label: '昨天' },
                { key: '3d', label: '最近3天' },
                { key: '7d', label: '最近7天' },
                { key: 'custom', label: '自定义' },
              ].map(r => (
                <button
                  key={r.key}
                  className={`${styles.quickDateBtn} ${quickRange === r.key ? styles.quickDateActive : ''}`}
                  onClick={() => handleQuickRange(r.key)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {quickRange === 'custom' && (
              <div className={styles.dateInputs}>
                <input
                  type="datetime-local"
                  className={styles.dateInput}
                  value={customSince}
                  onChange={e => setCustomSince(e.target.value)}
                />
                <span className={styles.dateSep}>—</span>
                <input
                  type="datetime-local"
                  className={styles.dateInput}
                  value={customUntil}
                  onChange={e => setCustomUntil(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* Log content */}
        <div className={styles.content} ref={scrollRef} onScroll={handleScroll}>
          {historyLoading && logs.length === 0 ? (
            <div className={styles.empty}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, opacity: 0.3 }}>hourglass_top</span>
              <span>加载中...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className={styles.empty}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, opacity: 0.3 }}>inbox</span>
              <span>暂无日志</span>
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={`${log.timestamp}-${i}`} className={`${styles.logLine} ${styles[`log${log.level}`] || ''}`}>
                <span className={styles.time}>
                  {mode === 'history' ? formatDateTime(log.timestamp) : formatTime(log.timestamp)}
                </span>
                <span className={styles.level} style={{ color: levelColor(log.level) }}>
                  {log.level.toUpperCase().padEnd(5)}
                </span>
                <span className={styles.source}>[{log.source}]</span>
                <span className={styles.message}>{log.message}</span>
              </div>
            ))
          )}
          {mode === 'history' && historyOffset + logs.length < historyTotal && (
            <div className={styles.loadMoreWrap}>
              <button className={styles.loadMoreBtn} onClick={handleLoadMore} disabled={historyLoading}>
                {historyLoading ? '加载中...' : `加载更多 (${historyTotal - historyOffset - logs.length} 条)`}
              </button>
            </div>
          )}
          {mode === 'realtime' && !autoScroll && (
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
