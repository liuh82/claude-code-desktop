use tauri::State;

use crate::app::{AppState, PaneStatus, Session};

#[tauri::command]
pub async fn create_session(
    state: State<'_, AppState>,
    project_path: String,
    pane_id: String,
    title: String,
) -> Result<Session, String> {
    let session = {
        let mut mgr = state.session_manager.lock().await;
        mgr.create(&project_path, &pane_id, &title)
    };

    // Link session to pane.
    let mut panes = state
        .panes
        .lock()
        .map_err(|e| format!("Failed to lock panes: {e}"))?;
    if let Some(pane) = panes.get_mut(&pane_id) {
        pane.session_id = Some(session.id.clone());
        pane.status = PaneStatus::Idle;
    }

    tracing::info!(session_id = %session.id, "session created");
    Ok(session)
}

#[tauri::command]
pub async fn start_session(
    state: State<'_, AppState>,
    session_id: String,
    model: Option<String>,
) -> Result<(), String> {
    // Start session (spawns process internally).
    let pid = {
        let mut mgr = state.session_manager.lock().await;
        mgr.start_session(&session_id, model.as_deref())
            .await
            .map_err(|e| e.to_string())?
    };

    // Update pane status to Running.
    let pane_id = {
        let mgr = state.session_manager.lock().await;
        mgr.get(&session_id)
            .map(|s| s.pane_id.clone())
            .unwrap_or_default()
    };

    if !pane_id.is_empty() {
        let mut panes = state
            .panes
            .lock()
            .map_err(|e| format!("Failed to lock panes: {e}"))?;
        if let Some(pane) = panes.get_mut(&pane_id) {
            pane.status = PaneStatus::Running;
        }
    }

    tracing::info!(session_id = %session_id, pid = pid, "session started");
    Ok(())
}

#[tauri::command]
pub async fn send_input(
    state: State<'_, AppState>,
    session_id: String,
    input: String,
) -> Result<(), String> {
    // Get pane_id before sending (to update pane status after).
    let pane_id = {
        let mgr = state.session_manager.lock().await;
        mgr.get(&session_id)
            .map(|s| s.pane_id.clone())
            .unwrap_or_default()
    };

    // Send the message.
    {
        let mut mgr = state.session_manager.lock().await;
        mgr.send_message(&session_id, &input)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Set pane to Waiting.
    if !pane_id.is_empty() {
        let mut panes = state
            .panes
            .lock()
            .map_err(|e| format!("Failed to lock panes: {e}"))?;
        if let Some(pane) = panes.get_mut(&pane_id) {
            pane.status = PaneStatus::Waiting;
        }
    }

    tracing::debug!(session_id = %session_id, len = input.len(), "input sent");
    Ok(())
}

#[tauri::command]
pub async fn stop_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    // Get pane_id before stopping.
    let pane_id = {
        let mgr = state.session_manager.lock().await;
        mgr.get(&session_id)
            .map(|s| s.pane_id.clone())
            .unwrap_or_default()
    };

    // Stop session (kills process internally).
    {
        let mut mgr = state.session_manager.lock().await;
        mgr.stop_session(&session_id)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Update pane status.
    if !pane_id.is_empty() {
        let mut panes = state
            .panes
            .lock()
            .map_err(|e| format!("Failed to lock panes: {e}"))?;
        if let Some(pane) = panes.get_mut(&pane_id) {
            pane.status = PaneStatus::Closed;
            pane.session_id = None;
        }
    }

    tracing::info!(session_id = %session_id, "session stopped");
    Ok(())
}

#[tauri::command]
pub async fn close_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<bool, String> {
    // Get pane_id before closing.
    let pane_id = {
        let mgr = state.session_manager.lock().await;
        mgr.get(&session_id)
            .map(|s| s.pane_id.clone())
            .unwrap_or_default()
    };

    // Close session (kills process if running).
    let existed = {
        let mut mgr = state.session_manager.lock().await;
        mgr.close_session(&session_id)
            .await
            .map_err(|e| e.to_string())?
    };

    // Clear pane link.
    if !pane_id.is_empty() {
        let mut panes = state
            .panes
            .lock()
            .map_err(|e| format!("Failed to lock panes: {e}"))?;
        if let Some(pane) = panes.get_mut(&pane_id) {
            pane.session_id = None;
            pane.status = PaneStatus::Idle;
        }
    }

    tracing::info!(session_id = %session_id, existed = existed, "session closed");
    Ok(existed)
}
