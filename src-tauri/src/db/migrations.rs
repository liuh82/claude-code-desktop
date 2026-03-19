use rusqlite::Connection;
use crate::error::AppError;

pub fn run_migrations(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS projects (
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
        );",
    )?;

    tracing::info!("Database migrations completed");
    Ok(())
}
