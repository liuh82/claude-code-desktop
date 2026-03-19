use tauri::State;
use crate::core::session_manager::Session;

#[tauri::command]
pub async fn create_session(
    state: State<'_, crate::app::AppState>,
    project_id: String,
    project_path: String,
) -> Result<Session, String> {
    let session = state.session_manager.create_session(project_id, project_path).await;
    Ok(session)
}

#[tauri::command]
pub async fn start_session(
    state: State<'_, crate::app::AppState>,
    session_id: String,
) -> Result<u32, String> {
    state.session_manager.start_session(&session_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_input(
    state: State<'_, crate::app::AppState>,
    session_id: String,
    input: String,
) -> Result<(), String> {
    state.session_manager.send_input(&session_id, &input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn close_session(
    state: State<'_, crate::app::AppState>,
    session_id: String,
) -> Result<(), String> {
    state.session_manager.close_session(&session_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_to_session(
    state: State<'_, crate::app::AppState>,
    session_id: String,
    input: String,
) -> Result<(), String> {
    state.session_manager.send_input(&session_id, &input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_sessions(
    state: State<'_, crate::app::AppState>,
    project_id: String,
) -> Result<Vec<Session>, String> {
    Ok(state.session_manager.list_sessions(&project_id).await)
}
