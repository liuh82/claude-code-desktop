use crate::core::tab_manager::TabManager;
use crate::core::session_manager::SessionManager;
use crate::core::process_pool::ProcessPool;
use crate::core::pane_manager::PaneManager;

pub struct AppState {
    pub tab_manager: TabManager,
    pub session_manager: SessionManager,
    pub process_pool: ProcessPool,
    pub pane_manager: PaneManager,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            tab_manager: TabManager::new(),
            session_manager: SessionManager::new(),
            process_pool: ProcessPool::new(),
            pane_manager: PaneManager::new(),
        }
    }
}
