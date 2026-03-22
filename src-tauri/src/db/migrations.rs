use rusqlite::Connection;

use crate::error::{AppError, AppResult};

/// Run all database migrations.
pub fn run(conn: &Connection) -> AppResult<()> {
    conn.execute_batch("CREATE TABLE IF NOT EXISTS _migrations (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );")
    .map_err(|e| AppError::Database(e))?;

    let migrations = get_migrations();

    for (name, sql) in &migrations {
        let applied: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM _migrations WHERE name = ?1",
                rusqlite::params![name],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Database(e))?;

        if applied {
            continue;
        }

        tracing::info!(migration = %name, "running migration");

        conn.execute_batch(sql)
            .map_err(|e| AppError::Database(e))?;

        conn.execute(
            "INSERT INTO _migrations (name) VALUES (?1)",
            rusqlite::params![name],
        )
        .map_err(|e| AppError::Database(e))?;
    }

    Ok(())
}

fn get_migrations() -> Vec<(&'static str, &'static str)> {
    vec![
        (
            "001_initial_schema",
            r#"
            CREATE TABLE IF NOT EXISTS tabs (
                id          TEXT PRIMARY KEY,
                title       TEXT NOT NULL DEFAULT '',
                active_pane_id TEXT NOT NULL DEFAULT '',
                project_path TEXT NOT NULL DEFAULT '',
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS panes (
                id          TEXT PRIMARY KEY,
                tab_id      TEXT NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
                title       TEXT NOT NULL DEFAULT '',
                session_id  TEXT,
                status      TEXT NOT NULL DEFAULT 'idle',
                created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
                updated_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id           TEXT PRIMARY KEY,
                project_id   TEXT NOT NULL,
                project_path TEXT NOT NULL DEFAULT '',
                pane_id      TEXT NOT NULL REFERENCES panes(id) ON DELETE SET NULL,
                title        TEXT NOT NULL DEFAULT '',
                status       TEXT NOT NULL DEFAULT 'idle',
                process_id   INTEGER,
                created_at   INTEGER NOT NULL,
                updated_at   INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL DEFAULT ''
            );
            "#,
        ),
    ]
}
