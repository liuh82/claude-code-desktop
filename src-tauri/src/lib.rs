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
            commands::tab::create_tab,
            commands::tab::split_pane,
            commands::tab::close_pane,
            commands::tab::focus_pane,
            commands::tab::close_tab,
            commands::session::create_session,
            commands::session::start_session,
            commands::session::send_input,
            commands::session::close_session,
            commands::settings::get_config,
            commands::settings::set_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
