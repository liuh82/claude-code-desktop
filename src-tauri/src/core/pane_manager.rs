use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use crate::core::session_manager::SessionManager;
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SplitType {
    Horizontal,
    Vertical,
    None,
}

impl std::fmt::Display for SplitType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SplitType::Horizontal => write!(f, "horizontal"),
            SplitType::Vertical => write!(f, "vertical"),
            SplitType::None => write!(f, "none"),
        }
    }
}

impl std::str::FromStr for SplitType {
    type Err = AppError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "horizontal" => Ok(SplitType::Horizontal),
            "vertical" => Ok(SplitType::Vertical),
            "none" | "" => Ok(SplitType::None),
            _ => Err(AppError::NotFound(format!("Unknown split type: {s}"))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pane {
    pub id: String,
    pub tab_id: String,
    pub session_id: Option<String>,
    pub split_type: String,
    pub position: u32,
    pub size_ratio: f32,
}

pub struct PaneManager {
    panes: Mutex<HashMap<String, Pane>>,
    session_manager: SessionManager,
}

impl PaneManager {
    pub fn new(session_manager: SessionManager) -> Self {
        Self {
            panes: Mutex::new(HashMap::new()),
            session_manager,
        }
    }

    /// Create a new pane in a tab. Optionally creates a Claude session for it.
    pub async fn create_pane(
        &self,
        tab_id: String,
        project_id: String,
        project_path: String,
        split_type: String,
        position: u32,
        create_session: bool,
    ) -> Result<Pane, AppError> {
        let pane_id = uuid::Uuid::new_v4().to_string();

        // Optionally create a Claude session for this pane
        let session_id = if create_session {
            let session = self
                .session_manager
                .create_session(project_id.clone(), project_path.clone())
                .await;
            Some(session.id)
        } else {
            None
        };

        let pane = Pane {
            id: pane_id.clone(),
            tab_id,
            session_id,
            split_type,
            position,
            size_ratio: 0.5,
        };

        let mut panes = self.panes.lock().await;
        panes.insert(pane_id.clone(), pane.clone());

        tracing::info!("Created pane id={} tab_id={} has_session={}", pane.id, pane.tab_id, pane.session_id.is_some());
        Ok(pane)
    }

    pub async fn close_pane(&self, pane_id: &str) -> Result<(), AppError> {
        let session_id_opt = {
            let panes = self.panes.lock().await;
            let pane = panes
                .get(pane_id)
                .ok_or_else(|| AppError::PaneNotFound(pane_id.to_string()))?;
            pane.session_id.clone()
        };

        // Close the associated session if any
        if let Some(sid) = session_id_opt {
            let _ = self.session_manager.close_session(&sid).await;
        }

        let mut panes = self.panes.lock().await;
        panes.remove(pane_id);
        tracing::info!("Closed pane id={pane_id}");
        Ok(())
    }

    /// Split an existing pane, creating a new sibling pane in the given direction.
    pub async fn split_pane(
        &self,
        pane_id: &str,
        direction: &str,
        project_id: &str,
        project_path: &str,
    ) -> Result<Vec<Pane>, AppError> {
        let panes = self.panes.lock().await;
        let existing = panes
            .get(pane_id)
            .ok_or_else(|| AppError::PaneNotFound(pane_id.to_string()))?;

        let tab_id = existing.tab_id.clone();
        let position = existing.position;
        drop(panes);

        // Update the existing pane's split type
        {
            let mut panes = self.panes.lock().await;
            if let Some(p) = panes.get_mut(pane_id) {
                p.split_type = direction.to_string();
            }
        }

        // Create the new pane
        let new_pane = self
            .create_pane(
                tab_id.clone(),
                project_id.to_string(),
                project_path.to_string(),
                direction.to_string(),
                position + 1,
                true,
            )
            .await?;

        // Return both panes
        let panes = self.panes.lock().await;
        let original = panes.get(pane_id).cloned();
        drop(panes);

        let mut result = Vec::new();
        if let Some(p) = original {
            result.push(p);
        }
        result.push(new_pane);

        tracing::info!("Split pane id={pane_id} direction={direction}");
        Ok(result)
    }

    pub async fn get_pane(&self, pane_id: &str) -> Option<Pane> {
        let panes = self.panes.lock().await;
        panes.get(pane_id).cloned()
    }

    pub async fn list_panes(&self, tab_id: &str) -> Vec<Pane> {
        let panes = self.panes.lock().await;
        panes.values()
            .filter(|p| p.tab_id == tab_id)
            .cloned()
            .collect()
    }

    pub async fn remove_pane(&self, pane_id: &str) -> Result<Pane, AppError> {
        let mut panes = self.panes.lock().await;
        panes
            .remove(pane_id)
            .ok_or_else(|| AppError::PaneNotFound(pane_id.to_string()))
    }
}
