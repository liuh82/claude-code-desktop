use tauri::State;

use crate::app::{AppState, Tab};
use crate::core::tab_manager::TabManager;

#[tauri::command]
pub fn create_tab(
    state: State<'_, AppState>,
    project_path: String,
    title: String,
) -> Result<Tab, String> {
    let tab = TabManager::create(&project_path, &title);

    let mut tabs = state
        .tabs
        .lock()
        .map_err(|e| format!("Failed to lock tabs: {}", e))?;

    // Create initial pane for this tab
    let pane = crate::core::pane_manager::PaneManager::create(&tab.id, "Terminal");

    let mut panes = state
        .panes
        .lock()
        .map_err(|e| format!("Failed to lock panes: {}", e))?;
    panes.insert(pane.id.clone(), pane);

    tabs.insert(tab.id.clone(), tab.clone());

    tracing::info!(tab_id = %tab.id, "tab created");
    Ok(tab)
}

#[tauri::command]
pub fn close_tab(state: State<'_, AppState>, tab_id: String) -> Result<bool, String> {
    let mut tabs = state
        .tabs
        .lock()
        .map_err(|e| format!("Failed to lock tabs: {}", e))?;

    let closed = TabManager::close(&mut tabs, &tab_id);
    tracing::info!(tab_id = %tab_id, closed = closed, "tab close requested");
    Ok(closed)
}

#[tauri::command]
pub fn list_tabs(state: State<'_, AppState>) -> Result<Vec<Tab>, String> {
    let tabs = state
        .tabs
        .lock()
        .map_err(|e| format!("Failed to lock tabs: {}", e))?;
    Ok(TabManager::list(&tabs))
}

#[tauri::command]
pub fn switch_tab(state: State<'_, AppState>, tab_id: String) -> Result<(), String> {
    let mut tabs = state
        .tabs
        .lock()
        .map_err(|e| format!("Failed to lock tabs: {}", e))?;
    TabManager::switch(&mut tabs, &tab_id)
}
