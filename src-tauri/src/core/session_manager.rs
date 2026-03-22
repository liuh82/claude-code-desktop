use std::collections::HashMap;
use std::path::Path;

use crate::app::{Session, SessionStatus};
use crate::core::process_pool::ProcessPool;
use crate::error::{AppError, AppResult};
use tokio::sync::Mutex;

/// Manages Claude CLI session lifecycle: create, start, stop, send.
///
/// The `ProcessPool` is wrapped in a `tokio::sync::Mutex` so async
/// methods can hold the lock across `.await` points safely.
pub struct SessionManager {
    sessions: HashMap<String, Session>,
    process_pool: Mutex<ProcessPool>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            process_pool: Mutex::new(ProcessPool::new()),
        }
    }

    /// Create a new session record (does not start the process).
    pub fn create(
        &mut self,
        project_path: &str,
        pane_id: &str,
        title: &str,
    ) -> Session {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();

        let session = Session {
            id: id.clone(),
            project_id: uuid::Uuid::new_v4().to_string(),
            project_path: project_path.to_string(),
            pane_id: pane_id.to_string(),
            title: title.to_string(),
            status: SessionStatus::Idle,
            process_id: None,
            created_at: now,
            updated_at: now,
        };
        self.sessions.insert(id, session.clone());
        session
    }

    /// Start a session: spawn the Claude CLI process via the process pool.
    pub async fn start_session(
        &mut self,
        session_id: &str,
        model: Option<&str>,
    ) -> AppResult<u32> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| AppError::NotFound(format!("Session not found: {session_id}")))?;

        if session.status == SessionStatus::Running {
            return Err(AppError::Process(format!(
                "Session {session_id} is already running"
            )));
        }

        session.status = SessionStatus::Starting;
        session.updated_at = chrono::Utc::now().timestamp_millis();

        let pane_id = session.pane_id.clone();
        let project_path = session.project_path.clone();

        // Spawn the CLI process (tokio::sync::MutexGuard is Send).
        {
            let mut pool = self.process_pool.lock().await;
            pool.spawn_bridge(&pane_id, Path::new(&project_path), model)
                .await?;
        }

        // Update session with PID.
        let session = self.sessions.get_mut(session_id).unwrap();
        let pid = {
            let pool = self.process_pool.lock().await;
            pool.pid(&pane_id)
        };

        session.status = SessionStatus::Running;
        session.process_id = pid;
        session.updated_at = chrono::Utc::now().timestamp_millis();

        tracing::info!(session_id = session_id, pid = ?pid, "session started");
        Ok(pid.unwrap_or(0))
    }

    /// Send a message to the CLI process backing a session.
    pub async fn send_message(&mut self, session_id: &str, message: &str) -> AppResult<()> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| AppError::NotFound(format!("Session not found: {session_id}")))?;

        if session.status != SessionStatus::Running {
            return Err(AppError::Process(format!(
                "Session {session_id} is not running (status: {})",
                session.status
            )));
        }

        let pane_id = session.pane_id.clone();

        let mut pool = self.process_pool.lock().await;
        pool.send_input(&pane_id, message).await
    }

    /// Stop a session: kill the CLI process and mark as closed.
    pub async fn stop_session(&mut self, session_id: &str) -> AppResult<()> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| AppError::NotFound(format!("Session not found: {session_id}")))?;

        let pane_id = session.pane_id.clone();
        session.status = SessionStatus::Closed;
        session.process_id = None;
        session.updated_at = chrono::Utc::now().timestamp_millis();

        let mut pool = self.process_pool.lock().await;
        pool.kill_bridge(&pane_id).await?;

        tracing::info!(session_id = session_id, "session stopped");
        Ok(())
    }

    /// Close and remove a session (kills process if running).
    pub async fn close_session(&mut self, session_id: &str) -> AppResult<bool> {
        let pane_id = self
            .sessions
            .get(session_id)
            .map(|s| s.pane_id.clone());

        if let Some(ref pid) = pane_id {
            let mut pool = self.process_pool.lock().await;
            let _ = pool.kill_bridge(pid).await;
        }

        let existed = self.sessions.remove(session_id).is_some();
        tracing::info!(session_id = session_id, existed = existed, "session closed");
        Ok(existed)
    }

    /// Get the current status of a session.
    pub fn get_status(&self, session_id: &str) -> Option<SessionStatus> {
        self.sessions.get(session_id).map(|s| s.status.clone())
    }

    /// Get a reference to a session by ID.
    pub fn get(&self, session_id: &str) -> Option<&Session> {
        self.sessions.get(session_id)
    }

    /// List all session IDs.
    pub fn list_ids(&self) -> Vec<String> {
        self.sessions.keys().cloned().collect()
    }

    /// Update the session status directly.
    pub fn set_status(
        &mut self,
        session_id: &str,
        status: SessionStatus,
    ) -> AppResult<()> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| AppError::NotFound(format!("Session not found: {session_id}")))?;
        session.status = status;
        session.updated_at = chrono::Utc::now().timestamp_millis();
        Ok(())
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}
