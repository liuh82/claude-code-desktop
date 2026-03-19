use tauri::State;
use crate::core::tab_manager::Tab;

#[tauri::command]
pub async fn create_tab(
    state: State<'_, crate::app::AppState>,
    project_id: String,
    project_path: String,
    title: String,
) -> Result<Tab, String> {
    state.tab_manager.create_tab(project_id, project_path, title)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn split_pane(
    state: State<'_, crate::app::AppState>,
    tab_id: String,
    pane_id: String,
    direction: String,
) -> Result<serde_json::Value, String> {
    state.tab_manager.split_pane(&tab_id, &pane_id, &direction)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn close_pane(
    state: State<'_, crate::app::AppState>,
    tab_id: String,
    pane_id: String,
) -> Result<serde_json::Value, String> {
    state.tab_manager.close_pane(&tab_id, &pane_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn focus_pane(
    state: State<'_, crate::app::AppState>,
    tab_id: String,
    pane_id: String,
) -> Result<(), String> {
    state.tab_manager.focus_pane(&tab_id, &pane_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn close_tab(
    state: State<'_, crate::app::AppState>,
    tab_id: String,
) -> Result<(), String> {
    state.tab_manager.close_tab(&tab_id)
        .await
        .map_err(|e| e.to_string())
}
