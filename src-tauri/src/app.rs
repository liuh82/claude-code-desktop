use std::sync::Arc;
use crate::core::process_pool::ProcessPool;
use crate::core::session_manager::SessionManager;
use crate::core::tab_manager::TabManager;
use crate::core::pane_manager::PaneManager;
use crate::db::Database;

pub struct AppState {
    pub tab_manager: TabManager,
    pub session_manager: SessionManager,
    pub process_pool: Arc<ProcessPool>,
    pub pane_manager: PaneManager,
    pub database: Database,
}

impl AppState {
    pub fn new(database: Database) -> Self {
        let process_pool = Arc::new(ProcessPool::new());
        let session_manager = SessionManager::new(Arc::clone(&process_pool));

        Self {
            tab_manager: TabManager::new(),
            session_manager,
            process_pool,
            pane_manager: PaneManager::new(),
            database,
        }
    }
}
