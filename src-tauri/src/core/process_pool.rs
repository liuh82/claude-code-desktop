use std::collections::HashMap;
use std::path::Path;

use crate::cli::bridge::ClaudeBridge;
use crate::error::{AppError, AppResult};

/// Manages spawned Claude CLI bridges, keyed by `pane_id`.
pub struct ProcessPool {
    bridges: HashMap<String, ClaudeBridge>,
    max_processes: usize,
}

impl ProcessPool {
    /// Create a new empty process pool with a default limit of 16.
    pub fn new() -> Self {
        Self {
            bridges: HashMap::new(),
            max_processes: 16,
        }
    }

    /// Create a pool with a custom process limit.
    pub fn with_limit(max_processes: usize) -> Self {
        Self {
            bridges: HashMap::new(),
            max_processes,
        }
    }

    /// Spawn a new Claude CLI bridge for the given pane.
    ///
    /// Returns an error if a bridge already exists for this pane or the
    /// pool has reached its maximum capacity.
    pub async fn spawn_bridge(
        &mut self,
        pane_id: &str,
        project_path: &Path,
        model: Option<&str>,
    ) -> AppResult<()> {
        if self.bridges.contains_key(pane_id) {
            return Err(AppError::Process(format!(
                "Bridge already exists for pane {pane_id}"
            )));
        }

        if self.bridges.len() >= self.max_processes {
            return Err(AppError::Process(format!(
                "Process pool limit reached ({})",
                self.max_processes
            )));
        }

        let bridge = ClaudeBridge::spawn(project_path, model).await?;
        tracing::info!(
            pane_id = pane_id,
            pid = ?bridge.pid(),
            "bridge spawned"
        );
        self.bridges.insert(pane_id.to_string(), bridge);
        Ok(())
    }

    /// Send a message to the bridge associated with the given pane.
    pub async fn send_input(&mut self, pane_id: &str, message: &str) -> AppResult<()> {
        let bridge = self
            .bridges
            .get_mut(pane_id)
            .ok_or_else(|| AppError::NotFound(format!("No bridge for pane {pane_id}")))?;

        bridge.send_message(message).await
    }

    /// Receive the next event from the bridge for the given pane.
    pub async fn recv_event(
        &mut self,
        pane_id: &str,
    ) -> AppResult<Option<crate::cli::parser::ClaudeEvent>> {
        let bridge = self
            .bridges
            .get_mut(pane_id)
            .ok_or_else(|| AppError::NotFound(format!("No bridge for pane {pane_id}")))?;

        Ok(bridge.recv_event().await)
    }

    /// Kill the bridge for the given pane and remove it from the pool.
    pub async fn kill_bridge(&mut self, pane_id: &str) -> AppResult<()> {
        if let Some(mut bridge) = self.bridges.remove(pane_id) {
            bridge.kill().await?;
            tracing::info!(pane_id = pane_id, "bridge killed and removed");
        }
        Ok(())
    }

    /// Check if the bridge for the given pane is still alive.
    pub fn is_alive(&mut self, pane_id: &str) -> bool {
        self.bridges
            .get_mut(pane_id)
            .map(|b| b.is_alive())
            .unwrap_or(false)
    }

    /// Number of bridges currently in the pool.
    pub fn active_count(&self) -> usize {
        self.bridges.len()
    }

    /// Check if a bridge exists for the given pane.
    pub fn contains(&self, pane_id: &str) -> bool {
        self.bridges.contains_key(pane_id)
    }

    /// Remove dead bridges and return their pane IDs.
    pub async fn cleanup_dead(&mut self) -> Vec<String> {
        let mut dead = Vec::new();
        for (pane_id, bridge) in &mut self.bridges {
            if !bridge.is_alive() {
                dead.push(pane_id.clone());
            }
        }
        for pane_id in &dead {
            self.bridges.remove(pane_id);
            tracing::info!(pane_id = pane_id, "dead bridge cleaned up");
        }
        dead
    }

    /// Kill all bridges and clear the pool.
    pub async fn kill_all(&mut self) -> AppResult<()> {
        let pane_ids: Vec<String> = self.bridges.keys().cloned().collect();
        for pane_id in &pane_ids {
            if let Some(mut bridge) = self.bridges.remove(pane_id) {
                if let Err(e) = bridge.kill().await {
                    tracing::warn!(pane_id = pane_id, error = %e, "failed to kill bridge");
                }
            }
        }
        tracing::info!(count = pane_ids.len(), "all bridges killed");
        Ok(())
    }

    /// Get the process ID for a pane's bridge, if any.
    pub fn pid(&self, pane_id: &str) -> Option<u32> {
        self.bridges.get(pane_id).and_then(|b| b.pid())
    }
}

impl Default for ProcessPool {
    fn default() -> Self {
        Self::new()
    }
}
