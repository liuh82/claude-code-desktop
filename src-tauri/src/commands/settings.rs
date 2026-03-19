#[tauri::command]
pub async fn get_config(_key: String) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!(null))
}

#[tauri::command]
pub async fn set_config(_key: String, _value: serde_json::Value) -> Result<(), String> {
    Ok(())
}
