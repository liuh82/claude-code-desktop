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

/// 从 ~/.claude/skills/ 读取 skills（每个目录含 SKILL.md）
fn read_skills_from_dir(skills_dir: &std::path::Path) -> Vec<SlashCommand> {
    let mut commands = Vec::new();
    let entries = match fs::read_dir(skills_dir) {
        Ok(e) => e,
        Err(_) => return commands,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let skill_name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        // 读取 SKILL.md 获取描述
        let skill_md = path.join("SKILL.md");
        let desc = match fs::read_to_string(&skill_md) {
            Ok(content) => {
                // 尝试从 frontmatter 读取 description，否则取第一行非空文本
                if let Some((_, fm_desc)) = parse_frontmatter(&content) {
                    fm_desc.unwrap_or_else(|| skill_name.clone())
                } else {
                    // 取第一行非空非注释的文本作为描述
                    content
                        .lines()
                        .map(|l| l.trim())
                        .filter(|l| !l.is_empty() && !l.starts_with('#') && !l.starts_with('<'))
                        .next()
                        .unwrap_or(&skill_name)
                        .chars()
                        .take(80)
                        .collect()
                }
            }
            Err(_) => skill_name.clone(),
        };

        commands.push(SlashCommand {
            name: format!("/{}", skill_name),
            description: desc,
            source: "skill".to_string(),
            plugin_name: None,
        });
    }

    commands
}

/// 从 ~/.claude/plugins/installed_plugins.json 读取已安装插件
fn read_installed_plugins(claude_dir: &std::path::Path) -> Vec<SlashCommand> {
    let mut commands = Vec::new();
    let plugins_json = claude_dir.join("plugins").join("installed_plugins.json");

    let content = match fs::read_to_string(&plugins_json) {
        Ok(c) => c,
        Err(_) => return commands,
    };

    // 简单解析 JSON：提取 plugin 名（"name@marketplace" 格式）
    // 只取顶级 key（如 "frontend-design@claude-plugins-official"）
    let data: serde_json::Value = match serde_json::from_str(&content) {
        Ok(d) => d,
        Err(_) => return commands,
    };

    if let Some(plugins) = data.get("plugins").and_then(|p| p.as_object()) {
        for key in plugins.keys() {
            // key 格式: "name@marketplace"
            let name = key.split('@').next().unwrap_or(key);
            commands.push(SlashCommand {
                name: format!("/{}", name),
                description: format!("{} plugin", name),
                source: "plugin".to_string(),
                plugin_name: Some(name.to_string()),
            });
        }
    }

    commands
}

#[tauri::command]
pub fn list_slash_commands(project_path: String) -> Result<Vec<SlashCommand>, String> {
    let mut commands = Vec::new();
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default();

    if !home.is_empty() {
        let claude_dir = PathBuf::from(&home).join(".claude");

        // 1. 全局 slash commands: ~/.claude/commands/*.md
        let commands_dir = claude_dir.join("commands");
        commands.extend(read_commands_from_dir(&commands_dir, "global"));

        // 2. Skills: ~/.claude/skills/*/SKILL.md
        let skills_dir = claude_dir.join("skills");
        commands.extend(read_skills_from_dir(&skills_dir));

        // 3. Plugins: ~/.claude/plugins/installed_plugins.json
        commands.extend(read_installed_plugins(&claude_dir));
    }

    // 4. 项目级 slash commands: {projectPath}/.claude/commands/*.md
    if !project_path.is_empty() {
        let project_dir = PathBuf::from(&project_path).join(".claude").join("commands");
        commands.extend(read_commands_from_dir(&project_dir, "project"));
    }

    Ok(commands)
}
