use thiserror::Error;

/// Unified application error type.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Process error: {0}")]
    Process(String),

    #[error("CLI error: {0}")]
    Cli(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Tauri error: {0}")]
    Tauri(String),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

impl From<AppError> for String {
    fn from(err: AppError) -> String {
        err.to_string()
    }
}

/// Helper to convert any error into a Tauri-compatible String result.
pub type AppResult<T> = Result<T, AppError>;
