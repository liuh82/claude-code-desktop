mod app;
mod cli;
mod commands;
mod core;
mod db;
mod error;

use db::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;

            let database = Database::new(app_data_dir)
                .map_err(|e| format!("Failed to initialize database: {e}"))?;

            app.manage(app::AppState::new(database));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Tab commands
            commands::tab::create_tab,
            commands::tab::close_tab,
            commands::tab::list_tabs,
            commands::tab::get_tab,
            commands::tab::update_tab_layout,
            commands::tab::set_active_pane,
            commands::tab::split_pane,
            commands::tab::close_pane,
            commands::tab::focus_pane,
            // Session commands
            commands::session::create_session,
            commands::session::start_session,
            commands::session::send_input,
            commands::session::send_to_session,
            commands::session::close_session,
            commands::session::list_sessions,
            // Project commands
            commands::project::open_project,
            commands::project::list_recent_projects,
            // Settings commands
            commands::settings::get_config,
            commands::settings::set_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
