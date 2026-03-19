use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use chrono::Utc;
use crate::core::process_pool::ProcessPool;
use crate::error::AppError;

#[derive(Debug, Clone)]
pub struct Session {
    pub id: String,
    pub project_id: String,
    pub project_path: String,
    pub pane_id: Option<String>,
    pub title: String,
    pub status: String,
    pub process_id: Option<u32>,
    pub created_at: String,
    pub updated_at: String,
}

pub struct SessionManager {
    sessions: Mutex<HashMap<String, Session>>,
    process_pool: Arc<ProcessPool>,
}

impl SessionManager {
    pub fn new(process_pool: Arc<ProcessPool>) -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            process_pool,
        }
    }

    pub async fn create_session(
        &self,
        project_id: String,
        project_path: String,
    ) -> Session {
        let now = Utc::now().to_rfc3339();
        let session = Session {
            id: uuid::Uuid::new_v4().to_string(),
            project_id,
            project_path,
            pane_id: None,
            title: String::new(),
            status: "idle".to_string(),
            process_id: None,
            created_at: now.clone(),
            updated_at: now,
        };
        tracing::info!("Created session id={}", session.id);

        let mut sessions = self.sessions.lock().await;
        sessions.insert(session.id.clone(), session.clone());
        session
    }

    pub async fn start_session(&self, session_id: &str) -> Result<u32, AppError> {
        let mut sessions = self.sessions.lock().await;
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        if session.status == "running" {
            return Err(AppError::SessionAlreadyRunning(session_id.to_string()));
        }

        let pid = self
            .process_pool
            .spawn(&session.project_path)
            .await?;

        session.status = "running".to_string();
        session.process_id = Some(pid);
        session.updated_at = Utc::now().to_rfc3339();

        // Associate process with session in pool (outside sessions lock)
        let sid = session_id.to_string();
        let pane = session.pane_id.clone().unwrap_or_default();
        drop(sessions);
        let _ = self.process_pool.associate(pid, sid, pane).await;

        tracing::info!("Started session id={session_id} pid={pid}");
        Ok(pid)
    }

    pub async fn send_input(&self, session_id: &str, input: &str) -> Result<(), AppError> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        let pid = session
            .process_id
            .ok_or_else(|| AppError::SessionNotRunning(session_id.to_string()))?;

        drop(sessions);
        self.process_pool.send_stdin(pid, input).await
    }

    pub async fn close_session(&self, session_id: &str) -> Result<(), AppError> {
        let mut sessions = self.sessions.lock().await;
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        if let Some(pid) = session.process_id {
            drop(sessions);
            let _ = self.process_pool.kill(pid).await;
            let mut sessions = self.sessions.lock().await;
            if let Some(s) = sessions.get_mut(session_id) {
                s.status = "closed".to_string();
                s.process_id = None;
                s.updated_at = Utc::now().to_rfc3339();
            }
        } else {
            session.status = "closed".to_string();
            session.updated_at = Utc::now().to_rfc3339();
        }

        tracing::info!("Closed session id={session_id}");
        Ok(())
    }

    pub async fn list_sessions(&self, project_id: &str) -> Vec<Session> {
        let sessions = self.sessions.lock().await;
        sessions
            .values()
            .filter(|s| s.project_id == project_id && s.status != "closed")
            .cloned()
            .collect()
    }

    pub async fn get_session(&self, session_id: &str) -> Option<Session> {
        let sessions = self.sessions.lock().await;
        sessions.get(session_id).cloned()
    }
}
