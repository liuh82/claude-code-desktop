use std::path::PathBuf;
use std::sync::Mutex;
use rusqlite::Connection;
use crate::db::migrations;
use crate::error::AppError;

#[derive(Clone)]
pub struct Database {
    conn: std::sync::Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, AppError> {
        std::fs::create_dir_all(&app_data_dir)?;
        let db_path = app_data_dir.join("claude-code-desktop.db");
        tracing::info!("Opening database at: {}", db_path.display());

        let conn = Connection::open(&db_path)?;
        migrations::run_migrations(&conn)?;

        Ok(Self {
            conn: std::sync::Arc::new(Mutex::new(conn)),
        })
    }

    /// Create an in-memory database as fallback when file-based DB fails.
    pub fn new_inmemory() -> Self {
        tracing::warn!("Using in-memory database as fallback");
        let conn = Connection::open_in_memory().expect("Failed to create in-memory database");
        migrations::run_migrations(&conn)
            .expect("Failed to run migrations on in-memory database");
        Self {
            conn: std::sync::Arc::new(Mutex::new(conn)),
        }
    }

    pub fn get_connection(&self) -> Result<std::sync::MutexGuard<'_, Connection>, AppError> {
        self.conn.lock().map_err(|e| AppError::Database(format!("Lock poisoned: {e}")))
    }
}
