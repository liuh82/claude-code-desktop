use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Database error: {0}")]
    Database(String),
    #[error("Process error: {0}")]
    Process(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    // Process-specific errors
    #[error("Command failed: {0}")]
    CommandFailed(String),
    #[error("Process not found: pid={0}")]
    ProcessNotFound(u32),
    #[error("Process timed out: pid={0}")]
    ProcessTimeout(u32),
    #[error("Max processes reached: {0}/{1}")]
    MaxProcessesReached(usize, usize),

    // Session-specific errors
    #[error("Session not found: {0}")]
    SessionNotFound(String),
    #[error("Session already running: {0}")]
    SessionAlreadyRunning(String),
    #[error("Session not running: {0}")]
    SessionNotRunning(String),

    // Tab-specific errors
    #[error("Tab not found: {0}")]
    TabNotFound(String),
    #[error("Cannot close last pane in tab: {0}")]
    CannotCloseLastPane(String),

    // Pane-specific errors
    #[error("Pane not found: {0}")]
    PaneNotFound(String),
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::Database(err.to_string())
    }
}

impl From<AppError> for tauri::ipc::InvokeError {
    fn from(err: AppError) -> Self {
        tauri::ipc::InvokeError::from(err.to_string())
    }
}
