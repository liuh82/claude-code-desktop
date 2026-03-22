use rusqlite::Connection;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::core::process_pool::ProcessPool;

// ── Data Structures ──────────────────────────────────────────────

/// Represents a tab (project workspace).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Tab {
    pub id: String,
    pub title: String,
    pub active_pane_id: String,
    pub project_path: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Represents a pane (terminal panel within a tab).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Pane {
    pub id: String,
    pub tab_id: String,
    pub title: String,
    pub session_id: Option<String>,
    pub status: PaneStatus,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PaneStatus {
    Idle,
    Starting,
    Running,
    Waiting,
    Error,
    Closed,
}

impl std::fmt::Display for PaneStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PaneStatus::Idle => write!(f, "idle"),
            PaneStatus::Starting => write!(f, "starting"),
            PaneStatus::Running => write!(f, "running"),
            PaneStatus::Waiting => write!(f, "waiting"),
            PaneStatus::Error => write!(f, "error"),
            PaneStatus::Closed => write!(f, "closed"),
        }
    }
}

/// Represents a Claude CLI session tied to a pane.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Session {
    pub id: String,
    pub project_id: String,
    pub project_path: String,
    pub pane_id: String,
    pub title: String,
    pub status: SessionStatus,
    pub process_id: Option<u32>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    Idle,
    Starting,
    Running,
    Waiting,
    Error,
    Closed,
}

impl std::fmt::Display for SessionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionStatus::Idle => write!(f, "idle"),
            SessionStatus::Starting => write!(f, "starting"),
            SessionStatus::Running => write!(f, "running"),
            SessionStatus::Waiting => write!(f, "waiting"),
            SessionStatus::Error => write!(f, "error"),
            SessionStatus::Closed => write!(f, "closed"),
        }
    }
}

// ── Application State ────────────────────────────────────────────

/// Global application state, managed by Tauri via `tauri::State`.
pub struct AppState {
    pub tabs: Arc<Mutex<HashMap<String, Tab>>>,
    pub panes: Arc<Mutex<HashMap<String, Pane>>>,
    pub sessions: Arc<Mutex<HashMap<String, Session>>>,
    pub process_pool: Arc<Mutex<ProcessPool>>,
    pub db: Arc<Mutex<Connection>>,
}

impl AppState {
    pub fn new(db: Connection) -> Self {
        Self {
            tabs: Arc::new(Mutex::new(HashMap::new())),
            panes: Arc::new(Mutex::new(HashMap::new())),
            sessions: Arc::new(Mutex::new(HashMap::new())),
            process_pool: Arc::new(Mutex::new(ProcessPool::new())),
            db: Arc::new(Mutex::new(db)),
        }
    }
}
