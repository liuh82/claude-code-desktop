use std::collections::HashMap;
use std::sync::Arc;
use chrono::Utc;
use serde_json::Value as JsonValue;
use tokio::sync::Mutex;
use crate::core::process_pool::ProcessPool;
use crate::core::session_manager::SessionManager;
use crate::db::Database;
use crate::error::AppError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Tab {
    pub id: String,
    pub project_id: String,
    pub project_path: String,
    pub title: String,
    pub active_pane_id: String,
    pub pane_ids: Vec<String>,
    pub layout_tree: Option<JsonValue>,
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct TabManager {
    tabs: Mutex<HashMap<String, Tab>>,
    database: Database,
    session_manager: SessionManager,
    process_pool: Arc<ProcessPool>,
}

impl TabManager {
    pub fn new(
        database: Database,
        session_manager: SessionManager,
        process_pool: Arc<ProcessPool>,
    ) -> Self {
        Self {
            tabs: Mutex::new(HashMap::new()),
            database,
            session_manager,
            process_pool,
        }
    }

    pub async fn create_tab(&self, project_id: String, project_path: String) -> Result<Tab, AppError> {
        // Derive title from directory name
        let title = std::path::Path::new(&project_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Untitled")
            .to_string();

        let now = Utc::now().timestamp();
        let tab = Tab {
            id: uuid::Uuid::new_v4().to_string(),
            project_id,
            project_path,
            title,
            active_pane_id: String::new(),
            pane_ids: Vec::new(),
            layout_tree: None,
            created_at: now,
            updated_at: now,
        };

        // Persist to DB
        self.insert_tab_db(&tab)?;

        // Create an initial pane for this tab
        // The pane manager is not directly accessible here; the command layer will handle
        // pane creation after tab creation. We store the tab first.

        let mut tabs = self.tabs.lock().await;
        tabs.insert(tab.id.clone(), tab.clone());

        tracing::info!("Created tab id={} project_path={}", tab.id, tab.project_path);
        Ok(tab)
    }

    pub async fn close_tab(&self, tab_id: &str) -> Result<(), AppError> {
        let mut tabs = self.tabs.lock().await;
        let tab = tabs
            .get(tab_id)
            .ok_or_else(|| AppError::TabNotFound(tab_id.to_string()))?;

        // Close all panes' sessions
        for pane_id in &tab.pane_ids {
            // Find sessions associated with this pane
            let sessions = self.session_manager.list_sessions_by_pane(pane_id).await;
            for session in sessions {
                let _ = self.session_manager.close_session(&session.id).await;
            }
        }

        // Remove from DB
        self.delete_tab_db(tab_id)?;

        tabs.remove(tab_id);
        tracing::info!("Closed tab id={tab_id}");
        Ok(())
    }

    pub async fn get_tab(&self, tab_id: &str) -> Option<Tab> {
        let tabs = self.tabs.lock().await;
        tabs.get(tab_id).cloned()
    }

    pub async fn list_tabs(&self, project_id: &str) -> Vec<Tab> {
        let tabs = self.tabs.lock().await;
        tabs.values()
            .filter(|t| t.project_id == project_id)
            .cloned()
            .collect()
    }

    pub async fn list_all_tabs(&self) -> Vec<Tab> {
        let tabs = self.tabs.lock().await;
        tabs.values().cloned().collect()
    }

    pub async fn update_layout(&self, tab_id: &str, layout: JsonValue) -> Result<(), AppError> {
        let mut tabs = self.tabs.lock().await;
        let tab = tabs
            .get_mut(tab_id)
            .ok_or_else(|| AppError::TabNotFound(tab_id.to_string()))?;

        tab.layout_tree = Some(layout);
        tab.updated_at = Utc::now().timestamp();

        self.update_tab_db(tab)?;
        Ok(())
    }

    pub async fn set_active_pane(&self, tab_id: &str, pane_id: &str) -> Result<(), AppError> {
        let mut tabs = self.tabs.lock().await;
        let tab = tabs
            .get_mut(tab_id)
            .ok_or_else(|| AppError::TabNotFound(tab_id.to_string()))?;

        if !tab.pane_ids.is_empty() && !tab.pane_ids.iter().any(|id| id == pane_id) {
            return Err(AppError::PaneNotFound(pane_id.to_string()));
        }

        tab.active_pane_id = pane_id.to_string();
        tab.updated_at = Utc::now().timestamp();

        self.update_tab_db(tab)?;
        Ok(())
    }

    pub async fn add_pane_to_tab(&self, tab_id: &str, pane_id: &str) -> Result<(), AppError> {
        let mut tabs = self.tabs.lock().await;
        let tab = tabs
            .get_mut(tab_id)
            .ok_or_else(|| AppError::TabNotFound(tab_id.to_string()))?;

        tab.pane_ids.push(pane_id.to_string());
        if tab.active_pane_id.is_empty() {
            tab.active_pane_id = pane_id.to_string();
        }
        tab.updated_at = Utc::now().timestamp();

        self.update_tab_db(tab)?;
        Ok(())
    }

    pub async fn remove_pane_from_tab(&self, tab_id: &str, pane_id: &str) -> Result<(), AppError> {
        let mut tabs = self.tabs.lock().await;
        let tab = tabs
            .get_mut(tab_id)
            .ok_or_else(|| AppError::TabNotFound(tab_id.to_string()))?;

        if tab.pane_ids.len() <= 1 {
            return Err(AppError::CannotCloseLastPane(tab_id.to_string()));
        }

        tab.pane_ids.retain(|id| id != pane_id);
        if tab.active_pane_id == pane_id {
            tab.active_pane_id = tab.pane_ids.first().cloned().unwrap_or_default();
        }
        tab.updated_at = Utc::now().timestamp();

        self.update_tab_db(tab)?;
        Ok(())
    }

    // --- DB helpers ---

    fn insert_tab_db(&self, tab: &Tab) -> Result<(), AppError> {
        let conn = self.database.get_connection()?;
        conn.execute(
            "INSERT INTO tabs (id, project_id, project_path, title, active_pane_id, layout_tree, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                tab.id,
                tab.project_id,
                tab.project_path,
                tab.title,
                tab.active_pane_id,
                tab.layout_tree.as_ref().and_then(|v| serde_json::to_string(v).ok()),
                tab.created_at,
                tab.updated_at,
            ],
        )?;
        Ok(())
    }

    fn update_tab_db(&self, tab: &Tab) -> Result<(), AppError> {
        let conn = self.database.get_connection()?;
        conn.execute(
            "UPDATE tabs SET project_id=?1, project_path=?2, title=?3, active_pane_id=?4,
             layout_tree=?5, updated_at=?6 WHERE id=?7",
            rusqlite::params![
                tab.project_id,
                tab.project_path,
                tab.title,
                tab.active_pane_id,
                tab.layout_tree.as_ref().and_then(|v| serde_json::to_string(v).ok()),
                tab.updated_at,
                tab.id,
            ],
        )?;
        Ok(())
    }

    fn delete_tab_db(&self, tab_id: &str) -> Result<(), AppError> {
        let conn = self.database.get_connection()?;
        conn.execute("DELETE FROM tabs WHERE id=?1", rusqlite::params![tab_id])?;
        Ok(())
    }
}
