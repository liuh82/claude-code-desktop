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
const sessions = new Map<string, ChildProcess>();
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
    title: 'Claude Code Desktop',
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
  // Try common paths
  const candidates = [
    '/usr/local/bin/claude',
    '/usr/bin/claude',
  ];

  // Try nvm-managed Node installations
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (home) {
    const nvmDir = path.join(home, '.nvm', 'versions', 'node');
    if (fs.existsSync(nvmDir)) {
      try {
        const entries = fs.readdirSync(nvmDir).sort().reverse();
        for (const entry of entries) {
          const binPath = path.join(nvmDir, entry, 'bin', 'claude');
          if (fs.existsSync(binPath)) {
            candidates.unshift(binPath);
          }
        }
      } catch {}
    }
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  return '';
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
    const session: Session = {
      id,
      projectPath,
      title: 'New Session',
      status: 'idle',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };
    if (db) {
      db.prepare(
        'INSERT INTO sessions (id, project_path, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, projectPath, session.title, session.status, now, now);
    }
    return { session_id: id };
  });

  ipcMain.handle('start-session', async (_event, { sessionId, projectPath, model, permissionMode }: {
    sessionId: string; projectPath: string; model?: string; permissionMode?: string;
  }) => {
    const cliPath = detectClaudeCli();
    if (!cliPath) throw new Error('Claude CLI not found');

    // Kill existing process if any
    const existing = sessions.get(sessionId);
    if (existing) {
      try { existing.kill('SIGTERM'); } catch {}
      sessions.delete(sessionId);
    }

    const args = ['--print', '--output-format', 'stream-json', '--verbose'];
    if (model) args.push('--model', model);
    if (permissionMode === 'auto') args.push('--permission-mode', 'auto');

    const proc = spawn(cliPath, args, {
      cwd: projectPath,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    sessions.set(sessionId, proc);

    // Stream stdout to renderer
    proc.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('claude-output', line);
        }
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('claude-stderr', data.toString());
      }
    });

    proc.on('close', (code) => {
      sessions.delete(sessionId);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('claude-exit', { sessionId, exitCode: code });
      }
      // Update DB
      if (db) {
        db.prepare("UPDATE sessions SET status = 'closed', updated_at = ? WHERE id = ?").run(
          new Date().toISOString(), sessionId
        );
      }
    });

    proc.on('error', (err) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('claude-error', { sessionId, error: err.message });
      }
    });

    // Update DB status
    if (db) {
      db.prepare("UPDATE sessions SET status = 'running', process_id = ?, updated_at = ? WHERE id = ?").run(
        proc.pid, new Date().toISOString(), sessionId
      );
    }

    return proc.pid || 0;
  });

  ipcMain.handle('send-input', (_event, { sessionId, input }: { sessionId: string; input: string }) => {
    const proc = sessions.get(sessionId);
    if (!proc || !proc.stdin) throw new Error(`Session ${sessionId} not running`);
    proc.stdin.write(input + '\n');
    return;
  });

  ipcMain.handle('send-to-session', (_event, { sessionId, input }: { sessionId: string; input: string }) => {
    // Alias for send-input
    const proc = sessions.get(sessionId);
    if (!proc || !proc.stdin) throw new Error(`Session ${sessionId} not running`);
    proc.stdin.write(input + '\n');
    return;
  });

  ipcMain.handle('close-session', (_event, { sessionId }: { sessionId: string }) => {
    const proc = sessions.get(sessionId);
    if (proc) {
      try { proc.kill('SIGTERM'); } catch {}
      sessions.delete(sessionId);
    }
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
