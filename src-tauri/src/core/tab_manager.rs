use std::collections::HashMap;

use crate::app::Tab;

/// Manages tab lifecycle: create, close, list.
#[derive(Default)]
pub struct TabManager;

impl TabManager {
    pub fn new() -> Self {
        Self
    }

    /// Create a new tab and return it.
    pub fn create(project_path: &str, title: &str) -> Tab {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        let pane_id = format!("pane-{}-0", &id[..8]);

        Tab {
            id: id.clone(),
            title: title.to_string(),
            active_pane_id: pane_id,
            project_path: project_path.to_string(),
            created_at: now,
            updated_at: now,
        }
    }

    /// Close a tab and return whether it existed.
    pub fn close(tabs: &mut HashMap<String, Tab>, tab_id: &str) -> bool {
        tabs.remove(tab_id).is_some()
    }

    /// List all tabs.
    pub fn list(tabs: &HashMap<String, Tab>) -> Vec<Tab> {
        tabs.values().cloned().collect()
    }

    /// Switch active tab (handled on frontend side, but we update updated_at).
    pub fn switch(tabs: &mut HashMap<String, Tab>, tab_id: &str) -> Result<(), String> {
        let tab = tabs
            .get_mut(tab_id)
            .ok_or_else(|| format!("Tab not found: {}", tab_id))?;
        tab.updated_at = chrono::Utc::now().timestamp_millis();
        Ok(())
    }
}
