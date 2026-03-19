use std::sync::Arc;
use crate::core::process_pool::ProcessPool;
use crate::core::session_manager::SessionManager;
use crate::core::tab_manager::TabManager;
use crate::core::pane_manager::PaneManager;
use crate::core::stream_handler::StreamHandler;
use crate::db::Database;

pub struct AppState {
    pub tab_manager: TabManager,
    pub session_manager: SessionManager,
    pub process_pool: Arc<ProcessPool>,
    pub pane_manager: PaneManager,
    pub stream_handler: StreamHandler,
    pub database: Database,
}

impl AppState {
    pub fn new(database: Database, app_handle: tauri::AppHandle) -> Self {
        let process_pool = Arc::new(ProcessPool::new());
        let session_manager = SessionManager::new(Arc::clone(&process_pool));

        let tab_manager = TabManager::new(
            database.clone(),
            session_manager.clone(),
            Arc::clone(&process_pool),
        );

        let pane_manager = PaneManager::new(session_manager.clone());
        let stream_handler = StreamHandler::new(app_handle);

        Self {
            tab_manager,
            session_manager,
            process_pool,
            pane_manager,
            stream_handler,
            database,
        }
    }
}
