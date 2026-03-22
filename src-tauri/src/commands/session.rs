use tauri::State;

use crate::app::{AppState, Session};
use crate::core::session_manager::SessionManager;

#[tauri::command]
pub fn create_session(
    state: State<'_, AppState>,
    project_path: String,
    pane_id: String,
    title: String,
) -> Result<Session, String> {
    let session = SessionManager::create(&project_path, &pane_id, &title);

    let mut sessions = state
        .sessions
        .lock()
        .map_err(|e| format!("Failed to lock sessions: {}", e))?;
    sessions.insert(session.id.clone(), session.clone());

    // Link session to pane
    let mut panes = state
        .panes
        .lock()
        .map_err(|e| format!("Failed to lock panes: {}", e))?;
    if let Some(pane) = panes.get_mut(&pane_id) {
        pane.session_id = Some(session.id.clone());
        pane.status = crate::app::PaneStatus::Idle;
    }

    tracing::info!(session_id = %session.id, "session created");
    Ok(session)
}

#[tauri::command]
pub fn start_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|e| format!("Failed to lock sessions: {}", e))?;

    SessionManager::start(&mut sessions, &session_id)?;

    // TODO: Actually spawn the claude CLI process via process_pool
    // and update pane status to Running.

    tracing::info!(session_id = %session_id, "session start requested");
    Ok(())
}

#[tauri::command]
pub fn send_input(
    _state: State<'_, AppState>,
    _session_id: String,
    _input: String,
) -> Result<(), String> {
    // TODO: Write input to the stdin of the Claude CLI process
    // associated with this session.
    Ok(())
}

#[tauri::command]
pub fn stop_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|e| format!("Failed to lock sessions: {}", e))?;

    SessionManager::stop(&mut sessions, &session_id)?;

    // TODO: Kill the process in process_pool.

    tracing::info!(session_id = %session_id, "session stopped");
    Ok(())
}

#[tauri::command]
pub fn close_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<bool, String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|e| format!("Failed to lock sessions: {}", e))?;

    let closed = SessionManager::close(&mut sessions, &session_id);

    tracing::info!(session_id = %session_id, closed = closed, "session closed");
    Ok(closed)
}
