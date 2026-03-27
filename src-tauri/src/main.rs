// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use claude_code_desktop_lib::{
    app::AppState,
    commands,
    db::connection,
};
use tauri::Manager;

fn main() {
    // Initialize tracing subscriber
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Resolve app data directory
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            // Initialize database
            let db = connection::init_db(app_data_dir)
                .expect("Failed to initialize database");

            // Build application state
            let state = AppState::new(db);

            // Manage state on the app handle
            app_handle.manage(state);

            tracing::info!("Claude Code Desktop initialized");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Tab commands
            commands::tab::create_tab,
            commands::tab::close_tab,
            commands::tab::list_tabs,
            commands::tab::switch_tab,
            // Pane commands
            commands::pane::split_pane,
            commands::pane::close_pane,
            commands::pane::update_pane_ratio,
            // Session commands
            commands::session::create_session,
            commands::session::start_session,
            commands::session::send_input,
            commands::session::stop_session,
            commands::session::close_session,
            // Settings commands
            commands::settings::get_settings,
            commands::settings::save_settings,
            // Slash commands
            commands::slash_commands::list_slash_commands,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
