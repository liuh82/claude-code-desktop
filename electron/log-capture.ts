/**
 * Ring buffer log capture for Electron main process.
 * Stores console.log/error/warn output for in-app log viewer.
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  source: string; // e.g. 'DirectAPI', 'ClaudeCLI', 'Main', 'System'
  message: string;
}

const MAX_ENTRIES = 2000;
let buffer: LogEntry[] = [];

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
