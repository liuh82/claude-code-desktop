use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;

use crate::cli::parser::ClaudeEvent;
use crate::error::{AppError, AppResult};

/// A spawned Claude CLI process with stdin/stdout handles.
pub struct ClaudeBridge {
    child: Child,
    event_rx: mpsc::Receiver<ClaudeEvent>,
}

impl ClaudeBridge {
    /// Spawn a new Claude CLI process in stream-json mode.
    pub async fn spawn(working_dir: &std::path::Path) -> AppResult<Self> {
        let mut child = Command::new("claude")
            .arg("--output-format")
            .arg("stream-json")
            .current_dir(working_dir)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| AppError::Process(format!("Failed to spawn claude CLI: {}", e)))?;

        let pid = child.id();
        tracing::info!(pid = pid, "Claude CLI spawned");

        // Take stdout handle from child
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| AppError::Process("Failed to capture stdout".to_string()))?;

        let (event_tx, event_rx) = mpsc::channel::<ClaudeEvent>(64);

        // Spawn a task to read stdout line by line
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if let Ok(Some(event)) = crate::cli::parser::parse_line(&line) {
                    if event_tx.send(event).await.is_err() {
                        break;
                    }
                }
            }
        });

        Ok(Self { child, event_rx })
    }

    /// Send a message to the Claude CLI via stdin.
    pub async fn send_input(&mut self, input: &str) -> AppResult<()> {
        let stdin = self
            .child
            .stdin
            .as_mut()
            .ok_or_else(|| AppError::Process("stdin not available".to_string()))?;

        stdin
            .write_all(input.as_bytes())
            .await
            .map_err(|e| AppError::Process(format!("Failed to write to stdin: {}", e)))?;
        stdin
            .write_all(b"\n")
            .await
            .map_err(|e| AppError::Process(format!("Failed to write newline: {}", e)))?;
        stdin
            .flush()
            .await
            .map_err(|e| AppError::Process(format!("Failed to flush stdin: {}", e)))?;

        Ok(())
    }

    /// Receive the next parsed event from stdout.
    pub async fn recv_event(&mut self) -> Option<ClaudeEvent> {
        self.event_rx.recv().await
    }

    /// Kill the Claude CLI process.
    pub async fn kill(&mut self) -> AppResult<()> {
        self.child
            .kill()
            .await
            .map_err(|e| AppError::Process(format!("Failed to kill process: {}", e)))?;
        let _ = self.child.wait().await;
        Ok(())
    }

    /// Get the process ID.
    pub fn pid(&self) -> Option<u32> {
        self.child.id()
    }
}
