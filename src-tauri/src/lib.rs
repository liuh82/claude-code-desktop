mod app;
mod cli;
mod commands;
mod core;
mod db;
mod error;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(app::AppState::new())
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
