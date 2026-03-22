use tauri::State;

use crate::app::{AppState, Pane};
use crate::core::pane_manager::PaneManager;

#[tauri::command]
pub fn split_pane(
    state: State<'_, AppState>,
    source_pane_id: String,
) -> Result<Pane, String> {
    let mut panes = state
        .panes
        .lock()
        .map_err(|e| format!("Failed to lock panes: {}", e))?;

    let new_pane = PaneManager::split(&mut panes, &source_pane_id)?;

    tracing::info!(
        source = %source_pane_id,
        new_pane = %new_pane.id,
        "pane split"
    );
    Ok(new_pane)
}

#[tauri::command]
pub fn close_pane(
    state: State<'_, AppState>,
    pane_id: String,
) -> Result<bool, String> {
    let mut panes = state
        .panes
        .lock()
        .map_err(|e| format!("Failed to lock panes: {}", e))?;

    let closed = PaneManager::close(&mut panes, &pane_id);

    tracing::info!(pane_id = %pane_id, closed = closed, "pane close requested");
    Ok(closed)
}

#[tauri::command]
pub fn update_pane_ratio(
    _state: State<'_, AppState>,
    _pane_id: String,
    _ratio: f64,
) -> Result<(), String> {
    // Pane layout ratios are managed on the frontend side.
    // This command is a placeholder for future backend-managed layouts.
    Ok(())
}
