use std::collections::HashMap;

use tauri::State;

use crate::app::AppState;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AppSettings {
    pub theme: String,
    pub font_size: u32,
    pub tab_size: u32,
    pub word_wrap: bool,
    pub extra: HashMap<String, serde_json::Value>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            font_size: 14,
            tab_size: 2,
            word_wrap: true,
            extra: HashMap::new(),
        }
    }
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let db = state
        .db
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    let mut stmt = db
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| format!("Failed to query settings: {}", e))?;

    let rows: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Failed to iterate settings: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let mut settings = AppSettings::default();
    for (key, value) in &rows {
        match key.as_str() {
            "theme" => settings.theme = value.clone(),
            "font_size" => {
                if let Ok(n) = value.parse() {
                    settings.font_size = n;
                }
            }
            "tab_size" => {
                if let Ok(n) = value.parse() {
                    settings.tab_size = n;
                }
            }
            "word_wrap" => settings.word_wrap = value == "true",
            _ => {
                if let Ok(v) = serde_json::from_str(value) {
                    settings.extra.insert(key.clone(), v);
                }
            }
        }
    }

    Ok(settings)
}

#[tauri::command]
pub fn save_settings(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    let db = state
        .db
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    let pairs: Vec<(&str, String)> = vec![
        ("theme", settings.theme.clone()),
        ("font_size", settings.font_size.to_string()),
        ("tab_size", settings.tab_size.to_string()),
        ("word_wrap", settings.word_wrap.to_string()),
    ];

    // Upsert core settings
    {
        let mut stmt = db
            .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)")
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        for (key, value) in &pairs {
            stmt.execute(rusqlite::params![key, value])
                .map_err(|e| format!("Failed to save setting {}: {}", key, e))?;
        }
    }

    // Upsert extra settings
    {
        let mut stmt = db
            .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)")
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        for (key, value) in &settings.extra {
            let json = serde_json::to_string(value)
                .map_err(|e| format!("Failed to serialize setting {}: {}", key, e))?;
            stmt.execute(rusqlite::params![key, json])
                .map_err(|e| format!("Failed to save extra setting {}: {}", key, e))?;
        }
    }

    tracing::info!("settings saved");
    Ok(())
}
