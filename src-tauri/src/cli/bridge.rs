use std::path::Path;

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::mpsc;

use crate::cli::parser::ClaudeEvent;
use crate::error::{AppError, AppResult};

/// A spawned Claude CLI process with stdin/stdout handles.
///
/// Communicates via `--output-format stream-json`. Events from stdout are
/// parsed in a background task and delivered through an mpsc channel.
pub struct ClaudeBridge {
    child: Child,
    stdin: ChildStdin,
    event_rx: mpsc::Receiver<ClaudeEvent>,
}

impl ClaudeBridge {
    /// Spawn a new Claude CLI process in stream-json mode.
    ///
    /// # Arguments
    /// * `project_path` - Working directory for the Claude CLI.
    /// * `model` - Optional model override (e.g. `"claude-opus-4-20250514"`).
    pub async fn spawn(project_path: &Path, model: Option<&str>) -> AppResult<Self> {
        let mut cmd = Command::new("claude");
        cmd.arg("--output-format")
            .arg("stream-json")
            .current_dir(project_path)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        if let Some(m) = model {
            cmd.arg("--model").arg(m);
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| AppError::Process(format!("Failed to spawn claude CLI: {e}")))?;

        let pid = child.id();
        tracing::info!(pid = pid, model = model, "Claude CLI spawned");

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| AppError::Process("Failed to capture stdin".to_string()))?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| AppError::Process("Failed to capture stdout".to_string()))?;

        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| AppError::Process("Failed to capture stderr".to_string()))?;

        let (event_tx, event_rx) = mpsc::channel::<ClaudeEvent>(256);

        // Background task: read stdout line by line, parse, and forward events.
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                match crate::cli::parser::parse_line(&line) {
                    Ok(Some(event)) => {
                        if event_tx.send(event).await.is_err() {
                            tracing::debug!("event receiver dropped, stopping stdout reader");
                            break;
                        }
                    }
                    Ok(None) => continue,
                    Err(e) => {
                        tracing::debug!(error = %e, "failed to parse CLI output line");
                    }
                }
            }
            tracing::debug!("stdout reader finished");
        });

        // Background task: drain stderr for logging (prevent pipe stall).
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                tracing::debug!(target: "claude::stderr", "{}", line.trim());
            }
        });

        Ok(Self {
            child,
            stdin,
            event_rx,
        })
    }

    /// Send a message to the Claude CLI via stdin.
    ///
    /// The message is written followed by a newline and flushed.
    pub async fn send_message(&mut self, message: &str) -> AppResult<()> {
        self.stdin
            .write_all(message.as_bytes())
            .await
            .map_err(|e| AppError::Process(format!("Failed to write to stdin: {e}")))?;
        self.stdin
            .write_all(b"\n")
            .await
            .map_err(|e| AppError::Process(format!("Failed to write newline: {e}")))?;
        self.stdin
            .flush()
            .await
            .map_err(|e| AppError::Process(format!("Failed to flush stdin: {e}")))?;

        tracing::debug!(len = message.len(), "message sent to CLI");
        Ok(())
    }

    /// Receive the next parsed event from stdout.
    ///
    /// Returns `None` when the stdout reader task has exited (process died).
    pub async fn recv_event(&mut self) -> Option<ClaudeEvent> {
        self.event_rx.recv().await
    }

    /// Kill the Claude CLI process and wait for it to exit.
    pub async fn kill(&mut self) -> AppResult<()> {
        self.child
            .kill()
            .await
            .map_err(|e| AppError::Process(format!("Failed to kill process: {e}")))?;
        let _ = self.child.wait().await;
        tracing::info!(pid = ?self.child.id(), "process killed");
        Ok(())
    }

    /// Check if the child process is still running.
    pub fn is_alive(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }

    /// Get the OS process ID, if available.
    pub fn pid(&self) -> Option<u32> {
        self.child.id()
    }
}
