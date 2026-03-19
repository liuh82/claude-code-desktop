use std::collections::HashMap;
use std::process::Stdio;
use std::time::Instant;
use tokio::io::AsyncWriteExt;
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use crate::error::AppError;

#[derive(Debug, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub session_id: Option<String>,
    pub pane_id: Option<String>,
    pub status: String,
    pub started_at: Instant,
    pub last_output_at: Instant,
}

pub struct ProcessPoolConfig {
    pub max_global: usize,
    pub max_per_tab: usize,
}

impl Default for ProcessPoolConfig {
    fn default() -> Self {
        Self {
            max_global: 10,
            max_per_tab: 5,
        }
    }
}

struct ProcessEntry {
    child: Child,
    info: ProcessInfo,
}

pub struct ProcessPool {
    config: ProcessPoolConfig,
    processes: Mutex<HashMap<u32, ProcessEntry>>,
}

impl ProcessPool {
    pub fn new() -> Self {
        Self {
            config: ProcessPoolConfig::default(),
            processes: Mutex::new(HashMap::new()),
        }
    }

    pub fn with_config(config: ProcessPoolConfig) -> Self {
        Self {
            config,
            processes: Mutex::new(HashMap::new()),
        }
    }

    pub async fn spawn(&self, project_path: &str) -> Result<u32, AppError> {
        let mut processes = self.processes.lock().await;

        if processes.len() >= self.config.max_global {
            return Err(AppError::MaxProcessesReached(
                processes.len(),
                self.config.max_global,
            ));
        }

        let child = Command::new("claude")
            .arg("--print")
            .arg("--verbose")
            .arg("--output-format")
            .arg("stream-json")
            .arg("--permission-mode")
            .arg("auto")
            .current_dir(project_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| AppError::CommandFailed(format!("Failed to spawn claude: {e}")))?;

        let pid = child.id().ok_or_else(|| {
            AppError::CommandFailed("Process started but has no PID".to_string())
        })?;

        let now = Instant::now();
        let entry = ProcessEntry {
            child,
            info: ProcessInfo {
                pid,
                session_id: None,
                pane_id: None,
                status: "running".to_string(),
                started_at: now,
                last_output_at: now,
            },
        };

        processes.insert(pid, entry);
        tracing::info!("Spawned claude process pid={pid} for path={project_path}");
        Ok(pid)
    }

    pub async fn kill(&self, pid: u32) -> Result<(), AppError> {
        let mut processes = self.processes.lock().await;
        let entry = processes
            .get_mut(&pid)
            .ok_or(AppError::ProcessNotFound(pid))?;

        entry.child.kill().await.map_err(|e| {
            AppError::Process(format!("Failed to kill process {pid}: {e}"))
        })?;
        entry.info.status = "killed".to_string();

        tracing::info!("Killed process pid={pid}");
        Ok(())
    }

    pub async fn send_stdin(&self, pid: u32, input: &str) -> Result<(), AppError> {
        let mut processes = self.processes.lock().await;
        let entry = processes
            .get_mut(&pid)
            .ok_or(AppError::ProcessNotFound(pid))?;

        let stdin = entry
            .child
            .stdin
            .as_mut()
            .ok_or_else(|| AppError::Process(format!("Process {pid} has no stdin")))?;

    stdin
        .write_all(input.as_bytes())
        .await
        .map_err(|e| AppError::Process(format!("Failed to write to process {pid}: {e}")))?;
    stdin
        .flush()
        .await
        .map_err(|e| AppError::Process(format!("Failed to flush process {pid}: {e}")))?;

    Ok(())
    }

    pub async fn get_status(&self, pid: u32) -> Option<ProcessInfo> {
        let processes = self.processes.lock().await;
        processes.get(&pid).map(|e| e.info.clone())
    }

    pub async fn list_active(&self) -> Vec<ProcessInfo> {
        let processes = self.processes.lock().await;
        processes
            .values()
            .filter(|e| e.info.status == "running")
            .map(|e| e.info.clone())
            .collect()
    }

    pub async fn cleanup_zombies(&self, max_idle_secs: u64) -> usize {
        let mut processes = self.processes.lock().await;
        let max_idle = std::time::Duration::from_secs(max_idle_secs);
        let now = Instant::now();
        let mut to_remove = Vec::new();

        for (&pid, entry) in processes.iter_mut() {
            // Check if process has exited
            match entry.child.try_wait() {
                Ok(Some(_status)) => {
                    to_remove.push(pid);
                    continue;
                }
                Ok(None) => {}
                Err(_) => {
                    to_remove.push(pid);
                    continue;
                }
            }

            // Check idle timeout
            if now.duration_since(entry.info.last_output_at) > max_idle {
                to_remove.push(pid);
            }
        }

        let count = to_remove.len();
        for pid in to_remove {
            if let Some(mut entry) = processes.remove(&pid) {
                let _ = entry.child.kill().await;
                let _ = entry.child.wait().await;
            }
        }

        if count > 0 {
            tracing::info!("Cleaned up {count} zombie processes");
        }
        count
    }

    pub async fn associate(&self, pid: u32, session_id: String, pane_id: String) -> Result<(), AppError> {
        let mut processes = self.processes.lock().await;
        let entry = processes
            .get_mut(&pid)
            .ok_or(AppError::ProcessNotFound(pid))?;
        entry.info.session_id = Some(session_id);
        entry.info.pane_id = Some(pane_id);
        Ok(())
    }
}
