use tauri::State;
use crate::core::tab_manager::Tab;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub last_opened_at: Option<String>,
}

#[tauri::command]
pub async fn open_project(
    state: State<'_, crate::app::AppState>,
    path: String,
) -> Result<Tab, String> {
    let project_id = uuid::Uuid::new_v4().to_string();
    let project_path = path.clone();

    // Upsert project record in DB
    {
        let conn = state.database.get_connection()
            .map_err(|e| e.to_string())?;

        let now = chrono::Utc::now().to_rfc3339();
        let name = std::path::Path::new(&path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();

        // Insert or update the project
        conn.execute(
            "INSERT INTO projects (id, name, path, last_opened_at, created_at) VALUES (?1, ?2, ?3, ?4, ?4)
             ON CONFLICT(path) DO UPDATE SET last_opened_at=?4",
            rusqlite::params![project_id, name, path, now],
        ).map_err(|e| e.to_string())?;
    }

    // Create a tab for the project
    let tab = state.tab_manager.create_tab(project_id, project_path.clone())
        .await
        .map_err(|e| e.to_string())?;

    // Create an initial pane with a session
    let pane = state.pane_manager.create_pane(
        tab.id.clone(),
        tab.project_id.clone(),
        tab.project_path.clone(),
        "none".to_string(),
        0,
        true,
    ).await.map_err(|e| e.to_string())?;

    // Register pane with tab
    state.tab_manager.add_pane_to_tab(&tab.id, &pane.id)
        .await
        .map_err(|e| e.to_string())?;

    tracing::info!("Opened project path={} tab_id={}", project_path, tab.id);
    Ok(tab)
}

#[tauri::command]
pub async fn list_recent_projects(
    state: State<'_, crate::app::AppState>,
) -> Result<Vec<Project>, String> {
    let conn = state.database.get_connection()
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, path, last_opened_at FROM projects ORDER BY last_opened_at DESC LIMIT 20",
        )
        .map_err(|e| e.to_string())?;

    let projects = stmt
        .query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                last_opened_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(projects)
}
