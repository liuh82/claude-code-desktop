use std::collections::HashMap;

use crate::app::{Session, SessionStatus};

/// Manages Claude CLI session lifecycle: create, start, stop.
pub struct SessionManager;

impl SessionManager {
    pub fn new() -> Self {
        Self
    }

    /// Create a new session record (does not start the process).
    pub fn create(
        project_path: &str,
        pane_id: &str,
        title: &str,
    ) -> Session {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();

        Session {
            id,
            project_id: uuid::Uuid::new_v4().to_string(),
            project_path: project_path.to_string(),
            pane_id: pane_id.to_string(),
            title: title.to_string(),
            status: SessionStatus::Idle,
            process_id: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Mark a session as starting.
    pub fn start(
        sessions: &mut HashMap<String, Session>,
        session_id: &str,
    ) -> Result<(), String> {
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;
        session.status = SessionStatus::Starting;
        session.updated_at = chrono::Utc::now().timestamp_millis();
        Ok(())
    }

    /// Mark a session as running with a process ID.
    pub fn set_running(
        sessions: &mut HashMap<String, Session>,
        session_id: &str,
        process_id: u32,
    ) -> Result<(), String> {
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;
        session.status = SessionStatus::Running;
        session.process_id = Some(process_id);
        session.updated_at = chrono::Utc::now().timestamp_millis();
        Ok(())
    }

    /// Stop a session and mark it as closed.
    pub fn stop(sessions: &mut HashMap<String, Session>, session_id: &str) -> Result<(), String> {
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;
        session.status = SessionStatus::Closed;
        session.process_id = None;
        session.updated_at = chrono::Utc::now().timestamp_millis();
        Ok(())
    }

    /// Close and remove a session.
    pub fn close(sessions: &mut HashMap<String, Session>, session_id: &str) -> bool {
        sessions.remove(session_id).is_some()
    }
}
