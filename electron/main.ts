import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import Database from 'better-sqlite3';
import fs from 'fs';
import { ClaudeDirectClient, loadDirectApiConfig, PermissionMode } from './claude-direct';

// ── Types ──

interface Session {
  id: string;
  projectPath: string;
  title: string;
  status: string;
  pid?: number;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface AppSettings {
  defaultProjectPath: string;
  autoSaveInterval: number;
  maxConcurrentSessions: number;
  theme: string;
  fontSize: number;
  fontFamily: string;
  claudeCliPath: string;
  defaultModel: string;
  permissionMode: string;
  maxTokens: number;
  logLevel: string;
  dataDirectory: string;
}

// ── State ──

let mainWindow: BrowserWindow | null = null;
// Map sessionId -> active Claude process (one at a time per session)
const sessions = new Map<string, ChildProcess>();
// Map sessionId -> accumulated session history (for context)
const sessionHistory = new Map<string, Array<{ role: string; content: string }>>();
// Map sessionId -> current model
const sessionModels = new Map<string, string>();
// Map sessionId -> Direct API client
const directClients = new Map<string, ClaudeDirectClient>();
let db: Database.Database | null = null;

// ── Database ──

function initDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'claude-code-desktop.db');
  console.log(`[CCDesk] Opening database: ${dbPath}`);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT UNIQUE NOT NULL,
      config TEXT,
      last_opened_at TEXT,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS tabs (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      project_path TEXT,
      title TEXT,
      active_pane_id TEXT,
      layout_tree TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      project_path TEXT,
      pane_id TEXT,
      title TEXT,
      status TEXT DEFAULT 'idle',
      process_id INTEGER,
      created_at TEXT,
      updated_at TEXT,
      message_count INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT,
      timestamp TEXT
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  console.log('[CCDesk] Database initialized');
}

// ── Window ──

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'CCDesk',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Dev: load from vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:1420');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production: load from built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Kill all CLI sessions
    for (const [id, proc] of sessions) {
      try { proc.kill('SIGTERM'); } catch {}
    }
    sessions.clear();
    // Stop all Direct API clients
    for (const [, client] of directClients) {
      client.cleanupPendingPermission();
      client.stop();
    }
    directClients.clear();
  });
}

// ── Claude CLI helpers ──

function detectClaudeCli(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (!home) return '';

  // Directly scan known Claude CLI installation paths
  // This is more reliable than shell -l which can timeout or fail silently
  const candidates: string[] = [];

  // 1. Homebrew (Apple Silicon)
  candidates.push('/opt/homebrew/bin/claude');
  // 2. Homebrew (Intel)
  candidates.push('/usr/local/bin/claude');
  // 3. System
  candidates.push('/usr/bin/claude');

  // 4. Most common Node versions for claude
  const commonNodeVersions = ['v24', 'v22', 'v20', 'v18'];
  for (const ver of commonNodeVersions) {
    candidates.push(path.join(home, '.nvm', 'versions', 'node', ver, 'bin', 'claude'));
  }

  // 5. npm global (common locations)
  const npmGlobalPaths = [
    path.join(home, '.npm-global', 'bin', 'claude'),
    path.join(home, '.npm-global', 'bin'),
    path.join(home, 'Library', 'pnpm', 'claude'),
    path.join(home, 'Library', 'pnpm'),
  ];
  candidates.push(...npmGlobalPaths);

  // 5. nvm-managed Node versions (scan all)
  const nvmDir = path.join(home, '.nvm', 'versions', 'node');
  if (fs.existsSync(nvmDir)) {
    try {
      const entries = fs.readdirSync(nvmDir).sort().reverse();
      for (const entry of entries) {
        candidates.push(path.join(nvmDir, entry, 'bin', 'claude'));
      }
    } catch {}
  }

  // 6. volta
  candidates.push(path.join(home, '.volta', 'bin', 'claude'));

  // 7. fnm
  const fnmDir = path.join(home, '.local', 'share', 'fnm', 'node-versions');
  if (fs.existsSync(fnmDir)) {
    try {
      for (const entry of fs.readdirSync(fnmDir)) {
        candidates.push(path.join(fnmDir, entry, 'installation', 'bin', 'claude'));
      }
    } catch {}
  }

  // 8. Current PATH directories
  const pathDirs = (process.env.PATH || '').split(path.delimiter);
  for (const dir of pathDirs) {
    candidates.push(path.join(dir, 'claude'));
  }

  // 9. Last resort: try login shell
  try {
    const { execSync } = require('child_process') as typeof import('child_process');
    const shell = process.env.SHELL || '/bin/zsh';
    const result = execSync(shell + " -l -c 'which claude' 2>/dev/null", {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    if (result && fs.existsSync(result)) {
      candidates.unshift(result); // Put shell result first
    }
  } catch {}

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return '';
}

/**
 * Send a message to Claude CLI using `claude -p` mode.
 * Each invocation is a standalone process — simpler and more reliable.
 */
function spawnClaudeMessage(sessionId: string, projectPath: string, message: string, model?: string) {
  // Use configured path first, fall back to auto-detection
  let cliPath = '';
  if (db) {
    try {
      const row = db.prepare("SELECT value FROM app_settings WHERE key = 'settings' LIMIT 1").get() as { value?: string } | undefined;
      if (row?.value) {
        const settings = JSON.parse(row.value) as { claudeCliPath?: string };
        if (settings.claudeCliPath && fs.existsSync(settings.claudeCliPath)) {
          cliPath = settings.claudeCliPath;
        }
      }
    } catch {}
  }
  if (!cliPath) {
    cliPath = detectClaudeCli();
  }
  if (!cliPath) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('claude-error', {
        sessionId,
        error: 'Claude CLI 未找到。请在设置中手动配置路径，或先安装 Claude Code CLI。',
      });
    }
    return;
  }

  // Kill any running process for this session
  const existing = sessions.get(sessionId);
  if (existing) {
    try { existing.kill('SIGTERM'); } catch {}
    sessions.delete(sessionId);
  }

  const CCDESK_SYSTEM_PROMPT = "CCDesk 桌面客户端支持以下扩展语法，请在需要可视化数据时使用：\n1. 图表可视化：使用 ```chart 代码块，内容为 ECharts JSON 配置。支持折线图、柱状图、饼图、散点图、雷达图等所有类型。\n2. 文件引用：用户消息中的 @path/to/file 表示引用项目文件。";
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'auto', '--append-system-prompt', CCDESK_SYSTEM_PROMPT];
  if (model) {
    args.push('--model', model);
  }


  // Ensure claude can find its own dependencies (node, npm, etc.)
  const claudeDir = path.dirname(cliPath);
  const childEnv = {
    ...process.env,
    PATH: [claudeDir, process.env.PATH || ''].join(':'),
  };

  const proc = spawn(cliPath, args, {
    cwd: projectPath,
    env: childEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  sessions.set(sessionId, proc);

  proc.on('error', (err) => {
    console.error('[CCDesk] spawn error:', err.message);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('claude-error', {
        sessionId,
        error: 'Claude CLI 启动失败: ' + err.message,
      });
    }
    sessions.delete(sessionId);
    console.log('[CCDesk] cleaned up after spawn error');
  });

  proc.on('spawn', () => {
  });

  // Save user message to DB
  if (db) {
    try {
      const userMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      db.prepare(
        'INSERT OR IGNORE INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)'
      ).run(userMsgId, sessionId, 'user', message, new Date().toISOString());
      db.prepare(
        "UPDATE sessions SET message_count = message_count + 1, updated_at = ? WHERE id = ?"
      ).run(new Date().toISOString(), sessionId);
    } catch (err) {
      console.error('[CCDesk] Failed to save user message:', err);
    }
  }

  // Send message via stdin (claude -p reads from stdin)
  if (proc.stdin) {
    proc.stdin.write(message);
    proc.stdin.end();
  }

  // Buffer incomplete lines + assistant message accumulation for DB persistence
  let lineBuffer = '';
  let currentAssistantContent = '';

  proc.stdout?.on('data', (data: Buffer) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      lineBuffer += data.toString();
      const lines = lineBuffer.split('\n');
      // Keep the last incomplete line in buffer
      lineBuffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;

        // Parse to detect assistant messages for DB persistence
        if (db) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'assistant' && parsed.message) {
              const msg = parsed.message;
              if (msg.content && Array.isArray(msg.content)) {
                const textBlocks = msg.content.filter((b: any) => b.type === 'text');
                const text = textBlocks.map((b: any) => b.text).join('');
                currentAssistantContent = text;
              }
              // Finalize assistant message to DB when stop_reason present
              if (msg.stop_reason && currentAssistantContent) {
                try {
                  const aMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                  db.prepare(
                    'INSERT OR IGNORE INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)'
                  ).run(aMsgId, sessionId, 'assistant', currentAssistantContent, new Date().toISOString());
                  db.prepare(
                    "UPDATE sessions SET message_count = message_count + 1, updated_at = ? WHERE id = ?"
                  ).run(new Date().toISOString(), sessionId);
                  currentAssistantContent = '';
                } catch {}
              }
            }
          } catch {}
        }

        mainWindow.webContents.send('claude-output', line, sessionId);
      }
    }
  });

  proc.stderr?.on('data', (data: Buffer) => {
    console.warn('[CCDesk stderr]', data.toString());
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('claude-stderr', data.toString(), sessionId);
    }
  });

  proc.on('close', (code) => {
    // Flush any remaining buffer
    if (lineBuffer.trim()) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('claude-output', lineBuffer, sessionId);
      }
      lineBuffer = '';
    }

    sessions.delete(sessionId);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('claude-exit', { sessionId, exitCode: code });
    }
    if (db) {
      db.prepare("UPDATE sessions SET status = 'idle', updated_at = ? WHERE id = ?").run(
        new Date().toISOString(), sessionId
      );
    }
  });

  proc.on('error', (err) => {
    console.error('[CCDesk process error]', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('claude-error', { sessionId, error: err.message });
    }
  });

  if (db) {
    db.prepare("UPDATE sessions SET status = 'running', process_id = ?, updated_at = ? WHERE id = ?").run(
      proc.pid, new Date().toISOString(), sessionId
    );
  }
}

// ── Direct API helpers ──

function getApiMode(): 'cli' | 'direct' {
  if (!db) return 'direct';
  try {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'settings' LIMIT 1").get() as { value?: string } | undefined;
    if (row?.value) {
      const settings = JSON.parse(row.value);
      // Only use CLI if explicitly set
      if (settings.apiMode === 'cli') return 'cli';
      return 'direct';
    }
  } catch {}
  return 'direct';
}

function handleDirectMessage(sessionId: string, projectPath: string, message: string, model?: string) {
  const config = loadDirectApiConfig(db);
  if (!config) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('claude-error', {
        sessionId,
        error: 'Direct API 未配置。请设置 ANTHROPIC_API_KEY（在 ~/.claude/settings.json 的 env 中，或在应用设置中配置）。',
      });
    }
    return;
  }

  // Override model if specified
  if (model) {
    config.model = model;
  }

  // Get or create client for this session
  let client = directClients.get(sessionId);
  if (!client) {
    client = new ClaudeDirectClient(config);
    directClients.set(sessionId, client);
    sessionModels.set(sessionId, config.model);

    // Wire up permission request callback
    client.onPermissionRequest = (toolCall) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tool-permission-request', { sessionId, toolCall });
      }
    };

    // Wire up tool execution status callback
    client.onToolExecution = (update) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tool-execution-update', { sessionId, update });
      }
    };

    // Read permission mode from settings
    try {
      if (db) {
        const row = db.prepare("SELECT value FROM app_settings WHERE key = 'settings' LIMIT 1").get() as { value?: string } | undefined;
        if (row?.value) {
          const settings = JSON.parse(row.value);
          const mode = (settings.permissionMode || 'auto') as PermissionMode;
          client.setPermissionMode(mode);
        }
      }
    } catch {}
  }

  // Save user message to DB
  if (db) {
    try {
      const userMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      db.prepare(
        'INSERT OR IGNORE INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)'
      ).run(userMsgId, sessionId, 'user', message, new Date().toISOString());
      db.prepare(
        "UPDATE sessions SET message_count = message_count + 1, updated_at = ? WHERE id = ?"
      ).run(new Date().toISOString(), sessionId);
    } catch (err) {
      console.error('[CCDesk] Failed to save user message:', err);
    }
  }

  // Track assistant content for DB persistence
  let assistantContent = '';
  // Guard: prevent claude-exit from firing after claude-error
  let errorSent = false;

  client.sendMessage(
    sessionId,
    message,
    projectPath,
    // onEvent — forward each SSE event to renderer
    (event) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const wrapped = JSON.stringify({ apiMode: 'direct', sessionId, event });
        mainWindow.webContents.send('claude-output', wrapped, sessionId);

        // Accumulate text content for DB persistence
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
          assistantContent += event.delta.text;
        }

        // Update model in sessionModels
        if (event.type === 'message_start' && event.message?.model) {
          sessionModels.set(sessionId, event.message.model);
        }
      }
    },
    // onError
    (error) => {
      errorSent = true;
      console.error(`[CCDesk DirectAPI] Error for session ${sessionId}: ${error}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('claude-error', { sessionId, error });
      }
    },
  ).then(() => {
    // If error was already sent, don't send claude-exit (avoids confusing double-signal)
    if (errorSent) {
      console.error(`[CCDesk DirectAPI] Skipping claude-exit (error already sent) for session ${sessionId}`);
      return;
    }

    // Save assistant message to DB
    if (db && assistantContent) {
      try {
        const aMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        db.prepare(
          'INSERT OR IGNORE INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)'
        ).run(aMsgId, sessionId, 'assistant', assistantContent, new Date().toISOString());
        db.prepare(
          "UPDATE sessions SET message_count = message_count + 1, updated_at = ? WHERE id = ?"
        ).run(new Date().toISOString(), sessionId);
      } catch {}
    }

    // Signal completion
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('claude-exit', { sessionId, exitCode: 0 });
    }

    if (db) {
      db.prepare("UPDATE sessions SET status = 'idle', updated_at = ? WHERE id = ?").run(
        new Date().toISOString(), sessionId
      );
    }
  }).catch(() => {
    // Already handled via onError callback
  });
}

// ── IPC Handlers ──

function registerIpcHandlers() {
  // ── App ──

  ipcMain.handle('get-app-info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  }));

  ipcMain.handle('check-claude-cli', () => {
    const cliPath = detectClaudeCli();
    if (!cliPath) {
      return { path: '', version: '', available: false };
    }
    try {
      const result = spawn(cliPath, ['--version'], { timeout: 5000 });
      let output = '';
      result.stdout?.on('data', (d) => { output += d.toString(); });
      return new Promise((resolve) => {
        result.on('close', (code) => {
          resolve({
            path: cliPath,
            version: output.trim(),
            available: code === 0 && output.trim().length > 0,
          });
        });
        result.on('error', () => {
          resolve({ path: cliPath, version: '', available: false });
        });
      });
    } catch {
      return { path: cliPath, version: '', available: false };
    }
  });



  // ── File Tree ──

  ipcMain.handle('read-directory', async (_event, { dirPath, maxDepth }: { dirPath: string; maxDepth?: number }) => {
    const depth = maxDepth || 5;
    const result: Array<{ name: string; path: string; type: string; children?: unknown[] }> = [];

    function walk(currentPath: string, currentDepth: number, parent: Array<{ name: string; path: string; type: string; children?: unknown[] }>) {
      try {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        // Sort: directories first, then alphabetically
        const sorted = entries.sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });

        for (const entry of sorted) {
          // Skip hidden files/dirs and common ignores
          if (entry.name.startsWith('.')) continue;
          if (['node_modules', '.git', 'dist', '__pycache__', '.next', 'target', 'build'].includes(entry.name) && currentDepth >= 1) continue;

          const fullPath = path.join(currentPath, entry.name);
          const relPath = fullPath; // Use absolute path for display

          if (entry.isDirectory()) {
            if (currentDepth >= depth) continue;
            const node = {
              name: entry.name,
              path: relPath,
              type: 'directory',
              children: [],
            };
            parent.push(node);
            walk(fullPath, currentDepth + 1, node.children!);
          } else {
            parent.push({
              name: entry.name,
              path: relPath,
              type: 'file',
            });
          }
        }
      } catch {}
    }

    walk(dirPath, 0, result);
    return result;
  });

  // ── Read File ──

  ipcMain.handle('read-file', async (_event, { filePath }: { filePath: string }) => {
    try {
      if (!fs.existsSync(filePath)) return { content: null, error: 'File not found' };
      const content = fs.readFileSync(filePath, 'utf-8');
      return { content, error: null };
    } catch (err: any) {
      return { content: null, error: err.message };
    }
  });

  // ── Claude Config ──

  ipcMain.handle('get-claude-config', () => {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    if (!home) return null;
    const configPaths = [
      path.join(home, '.claude', 'settings.json'),
      path.join(home, '.claude.json'),
    ];
    const merged: Record<string, unknown> = {};
    for (const cp of configPaths) {
      if (fs.existsSync(cp)) {
        try {
          const data = JSON.parse(fs.readFileSync(cp, 'utf-8'));
          Object.assign(merged, data);
        } catch {}
      }
    }
    const env = (merged.env || {}) as Record<string, string>;
    return {
      model: env.ANTHROPIC_MODEL || '',
      baseUrl: env.ANTHROPIC_BASE_URL || null,
      sonnetModel: env.ANTHROPIC_DEFAULT_SONNET_MODEL || 'claude-sonnet-4-6',
      opusModel: env.ANTHROPIC_DEFAULT_OPUS_MODEL || 'claude-opus-4-6',
      haikuModel: env.ANTHROPIC_DEFAULT_HAIKU_MODEL || 'claude-haiku-4-5-20251001',
    };
  });

  // ── Settings ──

  ipcMain.handle('get-settings', () => {
    if (!db) return {};
    try {
      const row = db.prepare("SELECT value FROM app_settings WHERE key = 'settings' LIMIT 1").get() as { value?: string } | undefined;
      if (row?.value) return JSON.parse(row.value);
    } catch {}
    return {};
  });

  ipcMain.handle('save-settings', (_event, settings: AppSettings) => {
    if (!db) return;
    const value = JSON.stringify(settings);
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('settings', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1").run(value);
  });

  // ── Sessions ──

  ipcMain.handle('create-session', (_event, { projectId, projectPath }: { projectId: string; projectPath: string }) => {
    const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    if (db) {
      db.prepare(
        'INSERT INTO sessions (id, project_path, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, projectPath, '新对话', 'idle', now, now);
    }

    // Init history and model for this session
    sessionHistory.set(id, []);
    sessionModels.set(id, '');

    return { session_id: id };
  });

  /**
   * Start session — just records the session, no process spawned yet.
   * The process is spawned when the first message is sent.
   */
  ipcMain.handle('start-session', async (_event, { sessionId, projectPath, model, permissionMode }: {
    sessionId: string; projectPath: string; model?: string; permissionMode?: string;
  }) => {
    if (model) {
      sessionModels.set(sessionId, model);
    }
    if (db) {
      db.prepare("UPDATE sessions SET status = 'idle', updated_at = ? WHERE id = ?").run(
        new Date().toISOString(), sessionId
      );
    }
    return 0;
  });

  /**
   * Send message — spawns `claude -p "message"` and streams output back.
   * Routes to Direct API or CLI based on settings.
   */
  ipcMain.handle('send-message', (_event, { sessionId, projectPath, message, model }: {
    sessionId: string; projectPath: string; message: string; model?: string;
  }) => {
    const apiMode = getApiMode();
    if (apiMode === 'direct') {
      handleDirectMessage(sessionId, projectPath, message, model);
    } else {
      const effectiveModel = model || sessionModels.get(sessionId) || undefined;
      spawnClaudeMessage(sessionId, projectPath, message, effectiveModel);
    }
    return;
  });

  /**
   * Send message via Direct API only (explicit call from renderer).
   */
  ipcMain.handle('send-message-direct', (_event, { sessionId, projectPath, message, model }: {
    sessionId: string; projectPath: string; message: string; model?: string;
  }) => {
    handleDirectMessage(sessionId, projectPath, message, model);
    return;
  });

  /**
   * Stop Direct API generation.
   */
  ipcMain.handle('stop-generation-direct', (_event, { sessionId }: { sessionId: string }) => {
    const client = directClients.get(sessionId);
    if (client) {
      client.stop();
    }
    return;
  });

  /**
   * Stop generation — kills the running claude process or stops Direct API stream.
   */
  ipcMain.handle('stop-generation', (_event, { sessionId }: { sessionId: string }) => {
    const proc = sessions.get(sessionId);
    if (proc) {
      try { proc.kill('SIGTERM'); } catch {}
      sessions.delete(sessionId);
    }
    const directClient = directClients.get(sessionId);
    if (directClient) {
      directClient.stop();
    }
    return;
  });

  /**
   * Send input to session stdin (legacy — kept for compatibility).
   */
  ipcMain.handle('send-input', (_event, { sessionId, input }: { sessionId: string; input: string }) => {
    const proc = sessions.get(sessionId);
    if (proc && proc.stdin) {
      proc.stdin.write(input + '\n');
    }
    return;
  });

  ipcMain.handle('send-to-session', (_event, { sessionId, input }: { sessionId: string; input: string }) => {
    const proc = sessions.get(sessionId);
    if (proc && proc.stdin) {
      proc.stdin.write(input + '\n');
    }
    return;
  });

  ipcMain.handle('close-session', (_event, { sessionId }: { sessionId: string }) => {
    const proc = sessions.get(sessionId);
    if (proc) {
      try { proc.kill('SIGTERM'); } catch {}
      sessions.delete(sessionId);
    }
    // Stop Direct API client if any
    const directClient = directClients.get(sessionId);
    if (directClient) {
      directClient.cleanupPendingPermission();
      directClient.stop();
      directClient.reset();
      directClients.delete(sessionId);
    }
    sessionHistory.delete(sessionId);
    sessionModels.delete(sessionId);
    if (db) {
      db.prepare("UPDATE sessions SET status = 'closed', updated_at = ? WHERE id = ?").run(
        new Date().toISOString(), sessionId
      );
    }
    return;
  });

  ipcMain.handle('list-sessions', (_event, { projectId }: { projectId: string }) => {
    if (!db) return [];
    return db.prepare(
      'SELECT id, project_path as projectPath, title, status, created_at as createdAt, updated_at as updatedAt, message_count as messageCount FROM sessions ORDER BY updated_at DESC'
    ).all();
  });

  // ── List Claude CLI sessions from ~/.claude/projects/ ──
  ipcMain.handle('list-claude-sessions', async (_event, { projectPath }: { projectPath: string }) => {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    if (!home || !projectPath) return [];

    // Encode project path: replace / and non-alphanumeric chars with -
    const encoded = projectPath.replace(/[^a-zA-Z0-9]/g, '-');
    const sessionsDir = path.join(home, '.claude', 'projects', encoded);

    if (!fs.existsSync(sessionsDir)) return [];

    try {
      const entries = fs.readdirSync(sessionsDir);
      const sessions: Array<{
        sessionId: string;
        preview: string;
        lastUsed: number;
        messageCount: number;
      }> = [];

      for (const entry of entries) {
        // Only process .jsonl files (skip directories)
        if (!entry.endsWith('.jsonl')) continue;

        const filePath = path.join(sessionsDir, entry);
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;

        const sessionId = entry.replace(/\.jsonl$/, '');

        // Read first few lines to extract session info
        let preview = '';
        let messageCount = 0;

        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n').filter(l => l.trim());
          messageCount = lines.length;

          // Find first user message for preview
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === 'user' && parsed.message?.content) {
                const text = typeof parsed.message.content === 'string'
                  ? parsed.message.content
                  : Array.isArray(parsed.message.content)
                    ? parsed.message.content
                        .filter((b: any) => b.type === 'text')
                        .map((b: any) => b.text)
                        .join(' ')
                    : '';
                if (text) {
                  preview = text.slice(0, 120).replace(/\n/g, ' ');
                  break;
                }
              }
            } catch {}
          }
        } catch {}

        sessions.push({
          sessionId,
          preview,
          lastUsed: stat.mtimeMs,
          messageCount,
        });
      }

      // Sort by most recently modified
      sessions.sort((a, b) => b.lastUsed - a.lastUsed);
      return sessions;
    } catch {
      return [];
    }
  });

  // ── Projects ──

  ipcMain.handle('open-project', (_event, { projectPath }: { projectPath: string }) => {
    const name = path.basename(projectPath);
    const now = new Date().toISOString();
    const id = `proj_${Date.now()}`;

    if (db) {
      db.prepare(`
        INSERT INTO projects (id, name, path, last_opened_at, created_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET last_opened_at = ?
      `).run(id, name, projectPath, now, now, now);
    }

    return {
      id,
      name,
      path: projectPath,
      favorite: false,
      lastOpened: Date.now(),
      sessionCount: 0,
    };
  });

  ipcMain.handle('list-recent-projects', () => {
    if (!db) return [];
    return db.prepare(
      'SELECT id, name, path, last_opened_at as lastOpenedAt, created_at as createdAt FROM projects ORDER BY last_opened_at DESC LIMIT 20'
    ).all();
  });

  // ── File Picker ──

  ipcMain.handle('open-file-dialog', async (_event, opts?: { filters?: Array<{ name: string; extensions: string[] }> }) => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: opts?.filters || [
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return [];
    return result.filePaths;
  });

  // ── Dialog ──

  ipcMain.handle('open-directory-dialog', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('open-in-external', (_event, url: string) => {
    shell.openExternal(url);
  });

  // ── Config (simple key-value) ──

  ipcMain.handle('get-config', (_event, { key }: { key: string }) => {
    if (!db) return null;
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value?: string } | undefined;
    return row?.value ? JSON.parse(row.value) : null;
  });

  ipcMain.handle('set-config', (_event, { key, value }: { key: string; value: unknown }) => {
    if (!db) return;
    db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(
      key, JSON.stringify(value), JSON.stringify(value)
    );
  });

  // ── Tool Permission ──

  ipcMain.handle('tool-permission-response', (_event, { sessionId, granted }: { sessionId: string; granted: boolean }) => {
    const client = directClients.get(sessionId);
    if (client) {
      client.grantPermission(granted);
    }
  });

  ipcMain.handle('set-permission-mode', (_event, { sessionId, mode }: { sessionId: string; mode: PermissionMode }) => {
    const client = directClients.get(sessionId);
    if (client) {
      client.setPermissionMode(mode);
    }
  });

  // ── Persistence: Messages ──

  ipcMain.handle('load-messages', (_event, { sessionId }: { sessionId: string }) => {
    if (!db) return [];
    return db.prepare(
      'SELECT id, role, content, timestamp FROM messages WHERE session_id = ? ORDER BY timestamp ASC'
    ).all(sessionId);
  });

  ipcMain.handle('get-project-sessions', (_event, { projectPath }: { projectPath: string }) => {
    if (!db) return [];
    return db.prepare(
      'SELECT s.id, s.title, s.status, s.created_at as createdAt, s.message_count as messageCount FROM sessions s WHERE s.project_path = ? ORDER BY s.updated_at DESC'
    ).all(projectPath);
  });

  ipcMain.handle('get-session-messages', (_event, { sessionId }: { sessionId: string }) => {
    if (!db) return [];
    return db.prepare(
      'SELECT id, role, content, timestamp FROM messages WHERE session_id = ? ORDER BY timestamp ASC'
    ).all(sessionId);
  });

  ipcMain.handle('delete-session', (_event, { sessionId }: { sessionId: string }) => {
    // Kill running process if any
    const proc = sessions.get(sessionId);
    if (proc) {
      try { proc.kill('SIGTERM'); } catch {}
      sessions.delete(sessionId);
    }
    // Stop Direct API client if any
    const directClient = directClients.get(sessionId);
    if (directClient) {
      directClient.cleanupPendingPermission();
      directClient.stop();
      directClient.reset();
      directClients.delete(sessionId);
    }
    sessionHistory.delete(sessionId);
    sessionModels.delete(sessionId);
    if (db) {
      const deleteMessages = db.prepare('DELETE FROM messages WHERE session_id = ?');
      const deleteSession = db.prepare('DELETE FROM sessions WHERE id = ?');
      const tx = db.transaction(() => {
        deleteMessages.run(sessionId);
        deleteSession.run(sessionId);
      });
      tx();
    }
    return;
  });

  // ── Persistence: Tab State ──

  ipcMain.handle('save-tab-state', (_event, { projectPath, tabData }: { projectPath: string; tabData: unknown }) => {
    if (!db) return;
    const now = new Date().toISOString();
    const value = JSON.stringify(tabData);
    db.prepare(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)"
    ).run(`tabs_${projectPath}`, value);
  });

  ipcMain.handle('load-tab-state', (_event, { projectPath }: { projectPath: string }) => {
    if (!db) return null;
    const row = db.prepare(
      "SELECT value FROM app_settings WHERE key = ?"
    ).get(`tabs_${projectPath}`) as { value?: string } | undefined;
    if (!row?.value) return null;
    try {
      return JSON.parse(row.value);
    } catch {
      return null;
    }
  });

  // ── Slash Commands Discovery ──

  interface SlashCommand {
    name: string;
    description: string;
    source: 'built-in' | 'plugin' | 'skill' | 'project';
    pluginName?: string;
  }

  ipcMain.handle('list-slash-commands', (_event, { projectPath }: { projectPath: string }): SlashCommand[] => {
    const commands: SlashCommand[] = [];
    const home = process.env.HOME || process.env.USERPROFILE || '';
    if (!home) return commands;

    // Parse YAML-like frontmatter from markdown files
    function parseFrontmatter(content: string): { name?: string; description?: string } {
      const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
      if (!match) return {};
      const front: Record<string, string> = {};
      for (const line of match[1].split('\n')) {
        const idx = line.indexOf(':');
        if (idx > 0) {
          const key = line.slice(0, idx).trim();
          const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          front[key] = val;
        }
      }
      return { name: front.name, description: front.description };
    }

    // 1. Plugin commands from ~/.claude/plugins/marketplaces/*/plugins/*/commands/*.md
    const marketplacesDir = path.join(home, '.claude', 'plugins', 'marketplaces');
    if (fs.existsSync(marketplacesDir)) {
      try {
        for (const marketplace of fs.readdirSync(marketplacesDir)) {
          const mpPath = path.join(marketplacesDir, marketplace, 'plugins');
          if (!fs.existsSync(mpPath)) continue;
          const plugins = fs.readdirSync(mpPath);
          for (const plugin of plugins) {
            const cmdDir = path.join(mpPath, plugin, 'commands');
            if (!fs.existsSync(cmdDir)) continue;
            for (const file of fs.readdirSync(cmdDir)) {
              if (!file.endsWith('.md')) continue;
              const cmdName = '/plugin:' + plugin + ':' + file.replace(/\.md$/, '');
              try {
                const content = fs.readFileSync(path.join(cmdDir, file), 'utf-8');
                const fm = parseFrontmatter(content);
                commands.push({
                  name: cmdName,
                  description: fm.description || file.replace(/\.md$/, ''),
                  source: 'plugin',
                  pluginName: plugin,
                });
              } catch {}
            }
          }
        }
      } catch {}
    }

    // 2. Skills from ~/.claude/plugins/marketplaces/omc/skills/*/SKILL.md
    const skillsDir = path.join(marketplacesDir, 'omc', 'skills');
    if (fs.existsSync(skillsDir)) {
      try {
        for (const skillDir of fs.readdirSync(skillsDir)) {
          const skillFile = path.join(skillsDir, skillDir, 'SKILL.md');
          if (!fs.existsSync(skillFile)) continue;
          try {
            const content = fs.readFileSync(skillFile, 'utf-8');
            const fm = parseFrontmatter(content);
            const name = fm.name || skillDir;
            commands.push({
              name: '/' + name,
              description: fm.description || name,
              source: 'skill',
              pluginName: 'omc',
            });
          } catch {}
        }
      } catch {}
    }

    // 3. Project commands from {projectPath}/.claude/commands/*.md
    if (projectPath) {
      const projectCmdDir = path.join(projectPath, '.claude', 'commands');
      if (fs.existsSync(projectCmdDir)) {
        try {
          for (const file of fs.readdirSync(projectCmdDir)) {
            if (!file.endsWith('.md')) continue;
            const cmdName = '/' + file.replace(/\.md$/, '');
            try {
              const content = fs.readFileSync(path.join(projectCmdDir, file), 'utf-8');
              const fm = parseFrontmatter(content);
              commands.push({
                name: cmdName,
                description: fm.description || file.replace(/\.md$/, ''),
                source: 'project',
              });
            } catch {}
          }
        } catch {}
      }
    }

    return commands;
  });
}

// ── App lifecycle ──


// ── Fix PATH for macOS Dock launches ──
// Dock-launched apps don't inherit shell PATH, so claude and other
// CLI tools installed via Homebrew/nvm/pnpm can't be found.
function fixPath() {
  if (process.platform !== 'darwin') return;
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (!home) return;

  const extraPaths: string[] = [];
  const currentPaths = (process.env.PATH || '').split(':');

  // 1. nvm: scan ALL installed node versions and add their bin dirs
  const nvmBase = path.join(home, '.nvm', 'versions', 'node');
  if (fs.existsSync(nvmBase)) {
    try {
      const entries = fs.readdirSync(nvmBase);
      for (const entry of entries) {
        const binDir = path.join(nvmBase, entry, 'bin');
        if (!currentPaths.includes(binDir)) {
          extraPaths.push(binDir);
        }
      }
    } catch {}
  }

  // 2. Homebrew
  ['/opt/homebrew/bin', '/usr/local/bin'].forEach(p => {
    if (!currentPaths.includes(p)) extraPaths.push(p);
  });

  // 3. volta
  const voltaBin = path.join(home, '.volta', 'bin');
  if (fs.existsSync(voltaBin) && !currentPaths.includes(voltaBin)) {
    extraPaths.push(voltaBin);
  }

  // 4. fnm
  const fnmBase = path.join(home, '.local', 'share', 'fnm', 'node-versions');
  if (fs.existsSync(fnmBase)) {
    try {
      for (const entry of fs.readdirSync(fnmBase)) {
        const binDir = path.join(fnmBase, entry, 'installation', 'bin');
        if (!currentPaths.includes(binDir)) extraPaths.push(binDir);
      }
    } catch {}
  }

  // 5. Try login shell as last resort
  try {
    const { execSync } = require('child_process') as typeof import('child_process');
    const shell = process.env.SHELL || '/bin/zsh';
    const shellPath = execSync(shell + " -l -c 'echo $PATH'", {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    if (shellPath) {
      for (const p of shellPath.split(':')) {
        if (!currentPaths.includes(p) && !extraPaths.includes(p)) {
          extraPaths.push(p);
        }
      }
    }
  } catch {}

  if (extraPaths.length > 0) {
    process.env.PATH = [...extraPaths, process.env.PATH || ''].join(':');
    console.log('[CCDesk] PATH fixed, added', extraPaths.length, 'entries');
    // Log to file for debugging Dock launches
    try {
      const logDir = path.join(home, 'Library', 'Logs', 'CCDesk');
      fs.mkdirSync(logDir, { recursive: true });
      require('fs').appendFileSync(path.join(logDir, 'path.log'), 
        new Date().toISOString() + ' PATH fixed: ' + extraPaths.join(', ') + '\n');
    } catch {}
  }
}

fixPath();

app.whenReady().then(() => {
  initDatabase();
  createWindow();
  registerIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
