use std::collections::HashMap;

use crate::app::{Pane, PaneStatus};

/// Manages pane lifecycle: split, close, update.
#[derive(Default)]
pub struct PaneManager;

impl PaneManager {
    pub fn new() -> Self {
        Self
    }

    /// Create an initial pane for a tab.
    pub fn create(tab_id: &str, title: &str) -> Pane {
        let short_tab = &tab_id[..8.min(tab_id.len())];
        let uuid_short = &uuid::Uuid::new_v4().to_string()[..8];
        let id = format!("pane-{}-{}", short_tab, uuid_short);
        Pane {
            id,
            tab_id: tab_id.to_string(),
            title: title.to_string(),
            session_id: None,
            status: PaneStatus::Idle,
        }
    }

    /// Split a pane, returning the new pane.
    pub fn split(panes: &mut HashMap<String, Pane>, source_pane_id: &str) -> Result<Pane, String> {
        let source = panes
            .get(source_pane_id)
            .ok_or_else(|| format!("Pane not found: {}", source_pane_id))?;

        let new_pane = Pane {
            id: {
                let uuid_short = &uuid::Uuid::new_v4().to_string()[..8];
                format!("pane-split-{}", uuid_short)
            },
            tab_id: source.tab_id.clone(),
            title: "Terminal".to_string(),
            session_id: None,
            status: PaneStatus::Idle,
        };

        panes.insert(new_pane.id.clone(), new_pane.clone());
        Ok(new_pane)
    }

    /// Close a pane and return whether it existed.
    pub fn close(panes: &mut HashMap<String, Pane>, pane_id: &str) -> bool {
        panes.remove(pane_id).is_some()
    }

    /// Update pane status.
    pub fn update_status(
        panes: &mut HashMap<String, Pane>,
        pane_id: &str,
        status: PaneStatus,
    ) -> Result<(), String> {
        let pane = panes
            .get_mut(pane_id)
            .ok_or_else(|| format!("Pane not found: {}", pane_id))?;
        pane.status = status;
        Ok(())
    }
}
