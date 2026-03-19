use tauri::State;
use crate::core::tab_manager::Tab;
use crate::core::pane_manager::Pane;

#[tauri::command]
pub async fn create_tab(
    state: State<'_, crate::app::AppState>,
    project_id: String,
    project_path: String,
) -> Result<Tab, String> {
    state.tab_manager.create_tab(project_id, project_path)
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

#[tauri::command]
pub async fn list_tabs(
    state: State<'_, crate::app::AppState>,
    project_id: String,
) -> Result<Vec<Tab>, String> {
    Ok(state.tab_manager.list_tabs(&project_id).await)
}

#[tauri::command]
pub async fn get_tab(
    state: State<'_, crate::app::AppState>,
    tab_id: String,
) -> Result<Option<Tab>, String> {
    Ok(state.tab_manager.get_tab(&tab_id).await)
}

#[tauri::command]
pub async fn update_tab_layout(
    state: State<'_, crate::app::AppState>,
    tab_id: String,
    layout: serde_json::Value,
) -> Result<(), String> {
    state.tab_manager.update_layout(&tab_id, layout)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_active_pane(
    state: State<'_, crate::app::AppState>,
    tab_id: String,
    pane_id: String,
) -> Result<(), String> {
    state.tab_manager.set_active_pane(&tab_id, &pane_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn split_pane(
    state: State<'_, crate::app::AppState>,
    pane_id: String,
    direction: String,
) -> Result<Vec<Pane>, String> {
    // Get the pane to find its tab and project info
    let pane = state.pane_manager.get_pane(&pane_id).await
        .ok_or_else(|| format!("Pane not found: {pane_id}"))?;

    let tab = state.tab_manager.get_tab(&pane.tab_id).await
        .ok_or_else(|| format!("Tab not found: {}", pane.tab_id))?;

    let new_panes = state.pane_manager.split_pane(
        &pane_id,
        &direction,
        &tab.project_id,
        &tab.project_path,
    ).await.map_err(|e| e.to_string())?;

    // Register the new pane with the tab
    for p in &new_panes {
        if p.id != pane_id {
            state.tab_manager.add_pane_to_tab(&tab.id, &p.id)
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(new_panes)
}

#[tauri::command]
pub async fn close_pane(
    state: State<'_, crate::app::AppState>,
    pane_id: String,
) -> Result<(), String> {
    let pane = state.pane_manager.get_pane(&pane_id).await
        .ok_or_else(|| format!("Pane not found: {pane_id}"))?;

    state.tab_manager.remove_pane_from_tab(&pane.tab_id, &pane_id)
        .await
        .map_err(|e| e.to_string())?;

    state.pane_manager.close_pane(&pane_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn focus_pane(
    state: State<'_, crate::app::AppState>,
    tab_id: String,
    pane_id: String,
) -> Result<(), String> {
    state.tab_manager.set_active_pane(&tab_id, &pane_id)
        .await
        .map_err(|e| e.to_string())
}
