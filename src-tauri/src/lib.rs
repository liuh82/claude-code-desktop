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
            let app_data_dir = match app.path().app_data_dir() {
                Ok(dir) => dir,
                Err(e) => {
                    eprintln!("[CCDesk] Failed to resolve app data dir: {e}");
                    // Fall back to a local directory
                    std::env::current_dir()
                        .expect("Cannot determine current directory")
                        .join(".claude-code-desktop")
                }
            };

            let database = match Database::new(app_data_dir) {
                Ok(db) => db,
                Err(e) => {
                    eprintln!("[CCDesk] Failed to initialize database: {e}");
                    // Create a minimal in-memory fallback so the app still works
                    Database::new_inmemory()
                }
            };

            app.manage(app::AppState::new(database, app.handle().clone()));

            // On macOS, open DevTools in debug builds for easier debugging
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

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
            // App commands
            commands::app_commands::get_app_info,
            commands::app_commands::get_settings,
            commands::app_commands::save_settings,
            commands::app_commands::check_claude_cli,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
