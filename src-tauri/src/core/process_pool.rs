use std::collections::HashMap;
use std::process::Child;

/// Manages spawned Claude CLI child processes.
pub struct ProcessPool {
    processes: HashMap<String, Child>,
}

impl ProcessPool {
    pub fn new() -> Self {
        Self {
            processes: HashMap::new(),
        }
    }

    /// Spawn a new Claude CLI process for the given session.
    pub fn spawn(
        &mut self,
        session_id: String,
        _working_dir: &std::path::Path,
    ) -> Result<u32, String> {
        // Placeholder: actual implementation will use tokio::process::Command
        // to spawn `claude --output-format stream-json` with piped stdin/stdout.
        let pid = 0; // will be replaced by actual process ID
        tracing::info!(session_id = %session_id, pid = pid, "spawning process");
        Ok(pid)
    }

    /// Kill a process by session ID.
    pub fn kill(&mut self, session_id: &str) -> Result<(), String> {
        if let Some(mut child) = self.processes.remove(session_id) {
            match child.kill() {
                Ok(()) => {
                    let _ = child.wait();
                    tracing::info!(session_id = %session_id, "process killed");
                    Ok(())
                }
                Err(e) => {
                    Err(format!("Failed to kill process for session {}: {}", session_id, e))
                }
            }
        } else {
            Err(format!("No process found for session {}", session_id))
        }
    }

    /// List all active session IDs with running processes.
    pub fn list(&self) -> Vec<String> {
        self.processes.keys().cloned().collect()
    }

    /// Check if a session has a running process.
    pub fn is_running(&self, session_id: &str) -> bool {
        self.processes.contains_key(session_id)
    }
}
