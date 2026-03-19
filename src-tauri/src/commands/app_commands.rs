use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub platform: String,
    pub arch: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CliInfo {
    pub path: String,
    pub version: String,
    pub available: bool,
}

/// Application metadata — version, platform, architecture.
#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

/// Persisted application settings (JSON blob stored in SQLite).
#[tauri::command]
pub async fn get_settings(
    state: State<'_, crate::app::AppState>,
) -> Result<serde_json::Value, String> {
    let conn = state
        .database
        .get_connection()
        .map_err(|e| e.to_string())?;

    let result: Result<String, _> = conn.query_row(
        "SELECT value FROM app_settings WHERE key = 'settings' LIMIT 1",
        [],
        |row| row.get(0),
    );

    match result {
        Ok(raw) => serde_json::from_str(&raw).map_err(|e| e.to_string()),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(serde_json::json!(null)),
        Err(e) => Err(e.to_string()),
    }
}

/// Persist application settings as a JSON blob.
#[tauri::command]
pub async fn save_settings(
    state: State<'_, crate::app::AppState>,
    settings: serde_json::Value,
) -> Result<(), String> {
    let conn = state
        .database
        .get_connection()
        .map_err(|e| e.to_string())?;

    let value = serde_json::to_string(&settings).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES ('settings', ?1)
         ON CONFLICT(key) DO UPDATE SET value = ?1",
        rusqlite::params![value],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Detect the Claude CLI binary: resolve path and extract version.
#[tauri::command]
pub async fn check_claude_cli() -> Result<CliInfo, String> {
    let path = detect_cli_path().unwrap_or_else(String::new);

    if path.is_empty() {
        return Ok(CliInfo {
            path: String::new(),
            version: String::new(),
            available: false,
        });
    }

    // Run `claude --version` to verify
    let output = tokio::process::Command::new(&path)
        .arg("--version")
        .output()
        .await
        .map_err(|e| format!("Failed to run claude --version: {e}"))?;

    let version = if output.status.success() {
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    } else {
        String::new()
    };

    let available = !version.is_empty();

    Ok(CliInfo {
        path,
        version,
        available,
    })
}

/// Try common locations to find the `claude` binary.
fn detect_cli_path() -> Option<String> {
    // 1. Try `which claude`
    if let Ok(output) = std::process::Command::new("which").arg("claude").output() {
        if output.status.success() {
            let p = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !p.is_empty() {
                return Some(p);
            }
        }
    }

    // 2. Common absolute paths
    let candidates = [
        "/usr/local/bin/claude",
        "/usr/bin/claude",
    ];

    for candidate in &candidates {
        if std::path::Path::new(candidate).exists() {
            return Some(candidate.to_string());
        }
    }

    // 3. nvm-managed Node installations
    if let Ok(home) = std::env::var("HOME") {
        let nvm_dir = std::path::Path::new(&home).join(".nvm/versions/node");
        if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
            let mut bins: Vec<std::path::PathBuf> = entries
                .filter_map(|e| e.ok())
                .map(|e| e.path().join("bin/claude"))
                .filter(|p| p.exists())
                .collect();
            bins.sort();
            bins.reverse(); // newest version first
            if let Some(p) = bins.into_iter().next() {
                return Some(p.to_string_lossy().to_string());
            }
        }
    }

    None
}
