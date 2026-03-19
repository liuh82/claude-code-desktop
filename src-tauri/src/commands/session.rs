use tauri::State;

#[tauri::command]
pub async fn create_session(
    _state: State<'_, crate::app::AppState>,
    project_id: String,
    project_path: String,
) -> Result<serde_json::Value, String> {
    // TODO: Phase 2 implementation
    Ok(serde_json::json!({"session_id": "pending"}))
}

#[tauri::command]
pub async fn start_session(
    _state: State<'_, crate::app::AppState>,
    session_id: String,
) -> Result<u32, String> {
    // TODO: Phase 2 implementation
    Ok(0)
}

#[tauri::command]
pub async fn send_input(
    _state: State<'_, crate::app::AppState>,
    session_id: String,
    input: String,
) -> Result<(), String> {
    // TODO: Phase 2 implementation
    Ok(())
}

#[tauri::command]
pub async fn close_session(
    _state: State<'_, crate::app::AppState>,
    session_id: String,
) -> Result<(), String> {
    // TODO: Phase 2 implementation
    Ok(())
}
