use std::path::PathBuf;

use rusqlite::Connection;

use crate::db::migrations;
use crate::error::{AppError, AppResult};

/// Initialize the SQLite database, running migrations if needed.
pub fn init_db(app_data_dir: PathBuf) -> AppResult<Connection> {
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| AppError::Io(e))?;

    let db_path = app_data_dir.join("ccdesk.db");
    tracing::info!(path = %db_path.display(), "opening database");

    let conn = Connection::open(&db_path)
        .map_err(|e| AppError::Database(e))?;

    // Enable WAL mode for better concurrent read performance.
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| AppError::Database(e))?;

    migrations::run(&conn)?;

    Ok(conn)
}
