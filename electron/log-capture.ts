/**
 * Ring buffer log capture for Electron main process.
 * Stores console.log/error/warn output for in-app log viewer.
 * Also supports persistent SQLite storage via batched writes.
 */

import type Database from 'better-sqlite3';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  source: string; // e.g. 'DirectAPI', 'ClaudeCLI', 'Main', 'System'
  message: string;
}

const MAX_ENTRIES = 2000;
let buffer: LogEntry[] = [];

// ── Persistent SQLite storage ──

let db: Database.Database | null = null;
let pendingQueue: LogEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let insertStmt: Database.Statement | null = null;

export function initLogPersistence(database: Database.Database) {
  db = database;
  insertStmt = db.prepare('INSERT INTO logs (timestamp, level, source, message) VALUES (?, ?, ?, ?)');

  // Delete logs older than 7 days
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  db.prepare('DELETE FROM logs WHERE timestamp < ?').run(cutoff);
  console.log(`[CCDesk] Log persistence initialized, cleaned entries older than 7 days`);

  // Batch flush every 1 second
  flushTimer = setInterval(flushLogs, 1000);
}

export function flushLogs() {
  if (!db || !insertStmt || pendingQueue.length === 0) return;
  const batch = pendingQueue.splice(0);
  const insertMany = db.transaction((entries: LogEntry[]) => {
    for (const entry of entries) {
      insertStmt!.run(entry.timestamp, entry.level, entry.source, entry.message);
    }
  });
  insertMany(batch);
}

export function stopLogPersistence() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flushLogs(); // final flush
}

function addEntry(level: LogLevel, source: string, message: string) {
  const entry: LogEntry = {
    timestamp: Date.now(),
    level,
    source,
    message,
  };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) {
    buffer = buffer.slice(-Math.floor(MAX_ENTRIES * 0.8)); // trim 20% at a time
  }
  // Also queue for SQLite persistence
  if (db) {
    pendingQueue.push(entry);
  }
}

export function logInfo(source: string, message: string) {
  addEntry('info', source, message);
}

export function logWarn(source: string, message: string) {
  addEntry('warn', source, message);
}

export function logError(source: string, message: string) {
  addEntry('error', source, message);
}

export function logDebug(source: string, message: string) {
  addEntry('debug', source, message);
}

export function getLogs(filter?: { level?: LogLevel; source?: string; search?: string; since?: number }): LogEntry[] {
  let logs = buffer;
  if (filter?.since) {
    logs = logs.filter(l => l.timestamp >= filter.since!);
  }
  if (filter?.level) {
    logs = logs.filter(l => l.level === filter.level);
  }
  if (filter?.source) {
    logs = logs.filter(l => l.source.toLowerCase().includes(filter.source!.toLowerCase()));
  }
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    logs = logs.filter(l => l.message.toLowerCase().includes(q));
  }
  return logs;
}

export function clearLogs() {
  buffer = [];
}

export function getLogCount(): number {
  return buffer.length;
}

/**
 * Monkey-patch console to capture all output into the ring buffer.
 */
export function initLogCapture() {
  const origError = console.error;
  const origWarn = console.warn;
  const origLog = console.log;

  console.error = (...args: unknown[]) => {
    origError(...args);
    addEntry('error', 'System', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
  };

  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    addEntry('warn', 'System', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
  };

  console.log = (...args: unknown[]) => {
    origLog(...args);
    // Only capture CCDesk-tagged logs to avoid noise
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    if (msg.includes('[CCDesk]') || msg.includes('[DirectAPI]') || msg.includes('Claude') || msg.includes('ERROR') || msg.includes('error')) {
      addEntry('info', 'System', msg);
    }
  };
}
