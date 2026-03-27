use serde::Serialize;
use std::fs;
use std::path::PathBuf;

/// Slash command 元数据
#[derive(Debug, Clone, Serialize)]
pub struct SlashCommand {
    name: String,
    description: String,
    source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    plugin_name: Option<String>,
}

/// 从 markdown 内容中解析 YAML frontmatter
fn parse_frontmatter(content: &str) -> Option<(Option<String>, Option<String>)> {
    let content = content.trim_start();
    if !content.starts_with("---") {
        return None;
    }
    let end = content[3..].find("---")?;
    let frontmatter = &content[3..3 + end];
    let mut name = None;
    let mut description = None;
    for line in frontmatter.lines() {
        let line = line.trim();
        if let Some(colon) = line.find(':') {
            let key = line[..colon].trim();
            let val = line[colon + 1..].trim();
            // 去掉引号
            let val = val.trim_start_matches('"').trim_end_matches('"');
            let val = val.trim_start_matches('\'').trim_end_matches('\'');
            match key {
                "name" => name = Some(val.to_string()),
                "description" => description = Some(val.to_string()),
                _ => {}
            }
        }
    }
    Some((name, description))
}

/// 从目录中读取 *.md 文件并解析为 SlashCommand 列表
fn read_commands_from_dir(dir: &std::path::Path, source: &str) -> Vec<SlashCommand> {
    let mut commands = Vec::new();
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return commands,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.extension().is_some_and(|ext| ext == "md") {
            continue;
        }

        let file_stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        let (fm_name, fm_desc) = match fs::read_to_string(&path) {
            Ok(content) => parse_frontmatter(&content).unwrap_or((None, None)),
            Err(_) => (None, None),
        };

        commands.push(SlashCommand {
            name: format!("/{}", fm_name.unwrap_or(file_stem.clone())),
            description: fm_desc.unwrap_or_else(|| file_stem.clone()),
            source: source.to_string(),
            plugin_name: None,
        });
    }

    commands
}

#[tauri::command]
pub fn list_slash_commands(project_path: String) -> Result<Vec<SlashCommand>, String> {
    let mut commands = Vec::new();
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default();

    // 1. 全局 slash commands: ~/.claude/commands/*.md
    if !home.is_empty() {
        let global_dir = PathBuf::from(&home).join(".claude").join("commands");
        commands.extend(read_commands_from_dir(&global_dir, "global"));
    }

    // 2. 项目级 slash commands: {projectPath}/.claude/commands/*.md
    if !project_path.is_empty() {
        let project_dir = PathBuf::from(&project_path).join(".claude").join("commands");
        commands.extend(read_commands_from_dir(&project_dir, "project"));
    }

    Ok(commands)
}
