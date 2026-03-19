use std::sync::Arc;
use tauri::Emitter;
use serde::Serialize;
use tokio::sync::mpsc;
use crate::core::output_parser::Token;

/// Payload emitted to the frontend via Tauri events.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event_type")]
pub enum StreamEvent {
    #[serde(rename = "output")]
    Output {
        session_id: String,
        pane_id: String,
        token: Token,
    },
    #[serde(rename = "error")]
    Error {
        session_id: String,
        pane_id: String,
        message: String,
    },
}

/// Handles output from Claude CLI processes and forwards it to the frontend
/// via Tauri event emission and internal channels.
#[derive(Clone)]
pub struct StreamHandler {
    app_handle: tauri::AppHandle,
    tx: mpsc::UnboundedSender<StreamEvent>,
    rx: Arc<tokio::sync::Mutex<Option<mpsc::UnboundedReceiver<StreamEvent>>>>,
}

impl StreamHandler {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        Self {
            app_handle,
            tx,
            rx: Arc::new(tokio::sync::Mutex::new(Some(rx))),
        }
    }

    /// Handle a parsed output token from a session.
    /// Emits the event to the frontend via Tauri and sends it to the internal channel.
    pub fn handle_output(
        &self,
        session_id: &str,
        pane_id: &str,
        token: Token,
    ) -> Result<(), String> {
        let event = StreamEvent::Output {
            session_id: session_id.to_string(),
            pane_id: pane_id.to_string(),
            token,
        };

        // Send to internal channel (non-blocking)
        let _ = self.tx.send(event.clone());

        // Emit to frontend via Tauri
        self.send_to_frontend("session-output", &event)
    }

    /// Handle an error from a session.
    pub fn handle_error(
        &self,
        session_id: &str,
        pane_id: &str,
        message: &str,
    ) -> Result<(), String> {
        let event = StreamEvent::Error {
            session_id: session_id.to_string(),
            pane_id: pane_id.to_string(),
            message: message.to_string(),
        };

        let _ = self.tx.send(event.clone());

        self.send_to_frontend("session-error", &event)
    }

    /// Emit a Tauri event to all webview windows.
    fn send_to_frontend(
        &self,
        event_type: &str,
        payload: &StreamEvent,
    ) -> Result<(), String> {
        self.app_handle
            .emit(event_type, payload)
            .map_err(|e| format!("Failed to emit event '{event_type}': {e}"))
    }

    /// Get a reference to the internal channel sender for spawning reader tasks.
    pub fn sender(&self) -> mpsc::UnboundedSender<StreamEvent> {
        self.tx.clone()
    }
}
