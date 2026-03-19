use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SplitDirection {
    Horizontal,
    Vertical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tab {
    pub tab_id: String,
    pub project_id: String,
    pub project_path: String,
    pub title: String,
    pub active_pane_id: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, thiserror::Error)]
pub enum TabError {
    #[error("Tab not found: {0}")]
    NotFound(String),
    #[error("Pane not found: {0}")]
    PaneNotFound(String),
    #[error("Cannot close last pane")]
    CannotCloseLastPane,
}

pub struct TabManager {}

impl TabManager {
    pub fn new() -> Self { Self {} }
    
    pub async fn create_tab(&self, project_id: String, project_path: String, title: String) -> Result<Tab, TabError> {
        Ok(Tab {
            tab_id: uuid::Uuid::new_v4().to_string(),
            project_id,
            project_path,
            title,
            active_pane_id: String::new(),
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
        })
    }
    
    pub async fn split_pane(&self, _tab_id: &str, _pane_id: &str, _direction: &str) -> Result<serde_json::Value, TabError> {
        Ok(serde_json::json!({
            "pane_id": uuid::Uuid::new_v4().to_string(),
            "layout": {"node_type": "split", "direction": _direction}
        }))
    }
    
    pub async fn close_pane(&self, _tab_id: &str, _pane_id: &str) -> Result<serde_json::Value, TabError> {
        Ok(serde_json::json!({
            "layout": {"node_type": "leaf", "pane_id": _pane_id}
        }))
    }
    
    pub async fn focus_pane(&self, _tab_id: &str, _pane_id: &str) -> Result<(), TabError> {
        Ok(())
    }
    
    pub async fn close_tab(&self, _tab_id: &str) -> Result<(), TabError> {
        Ok(())
    }
}
