import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import Database from 'better-sqlite3';
import fs from 'fs';

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
    width: 1024,
    height: 720,
    minWidth: 640,
    minHeight: 480,
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
    // Kill all sessions
    for (const [id, proc] of sessions) {
      try { proc.kill('SIGTERM'); } catch {}
    }
    sessions.clear();
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
      console.log(`[CCDesk] Found claude at: ${p}`);
      return p;
    }
  }
  console.log("[CCDesk] Claude CLI not found. Scanned", candidates.length, "paths");

  return '';
}

/**
 * Send a message to Claude CLI using `claude -p` mode.
 * Each invocation is a standalone process — simpler and more reliable.
 */
function spawnClaudeMessage(sessionId: string, projectPath: string, message: string, model?: string) {
  console.log('[CCDesk] spawnClaudeMessage called:', { sessionId, projectPath, messageLen: message.length, model });
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

  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'auto'];
  if (model) {
    args.push('--model', model);
  }

  console.log(`[CCDesk] Spawning claude: ${cliPath} ${args.join(' ')}`);

  const proc = spawn(cliPath, args, {
    cwd: projectPath,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  sessions.set(sessionId, proc);

  // Send message via stdin (claude -p reads from stdin)
  if (proc.stdin) {
    proc.stdin.write(message);
    proc.stdin.end();
  }

  // Buffer incomplete lines
  let lineBuffer = '';

  proc.stdout?.on('data', (data: Buffer) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      lineBuffer += data.toString();
      const lines = lineBuffer.split('\n');
      // Keep the last incomplete line in buffer
      lineBuffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) {
          mainWindow.webContents.send('claude-output', line, sessionId);
        }
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
   * This is the primary interaction method.
   */
  ipcMain.handle('send-message', (_event, { sessionId, projectPath, message, model }: {
    sessionId: string; projectPath: string; message: string; model?: string;
  }) => {
    console.log('[CCDesk] send-message received:', { sessionId, projectPath, message: message.substring(0, 50), model });
    const effectiveModel = model || sessionModels.get(sessionId) || undefined;
    console.log('[CCDesk] effectiveModel:', effectiveModel);
    spawnClaudeMessage(sessionId, projectPath, message, effectiveModel);
    return;
  });

  /**
   * Stop generation — kills the running claude process.
   */
  ipcMain.handle('stop-generation', (_event, { sessionId }: { sessionId: string }) => {
    const proc = sessions.get(sessionId);
    if (proc) {
      try { proc.kill('SIGTERM'); } catch {}
      sessions.delete(sessionId);
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
      'SELECT id, project_path as projectPath, title, status, created_at as createdAt, updated_at as updatedAt FROM sessions ORDER BY updated_at DESC'
    ).all();
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
  const shell = process.env.SHELL || '/bin/zsh';

  // Try to get PATH from login shell
  try {
    const { execSync } = require('child_process') as typeof import('child_process');
    const shellPath = execSync(shell + " -l -c 'echo $PATH'", {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    if (shellPath) {
      const shellPaths = shellPath.split(':');
      const currentPaths = (process.env.PATH || '').split(':');
      for (const p of shellPaths) {
        if (!currentPaths.includes(p)) {
          extraPaths.push(p);
        }
      }
    }
  } catch {}

  // Always add known directories as fallback
  extraPaths.push(
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(home, '.nvm', 'versions', 'node'),
  );

  // Merge: shell paths first, then existing PATH
  if (extraPaths.length > 0) {
    process.env.PATH = [...extraPaths, process.env.PATH || ''].join(':');
    console.log('[CCDesk] PATH fixed, length:', process.env.PATH.length);
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
