use serde::{Deserialize, Serialize};

/// Tokens emitted by parsing Claude CLI stream-json output.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "token_type")]
pub enum Token {
    #[serde(rename = "assistant")]
    Assistant { text: String },

    #[serde(rename = "tool_use")]
    ToolUse { name: String, input: String },

    #[serde(rename = "tool_result")]
    ToolResult { content: String, is_error: bool },

    #[serde(rename = "done")]
    Done { session_id: Option<String>, result: Option<String> },

    #[serde(rename = "error")]
    Error(String),
}

/// A raw parsed event from Claude CLI stream-json output before conversion to Token.
#[derive(Debug, Deserialize)]
struct StreamEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(default)]
    message: Option<StreamMessage>,
    #[serde(default)]
    result: Option<String>,
    #[serde(default)]
    session_id: Option<String>,
    #[serde(default)]
    delta: Option<DeltaContent>,
    #[serde(default)]
    content_block: Option<ContentBlock>,
    #[serde(default)]
    subtype: Option<String>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StreamMessage {
    #[serde(default)]
    content: Option<serde_json::Value>,
    #[serde(default)]
    role: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DeltaContent {
    #[serde(rename = "type")]
    delta_type: Option<String>,
    #[serde(default)]
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    block_type: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    input: Option<serde_json::Value>,
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    is_error: Option<bool>,
}

/// Parse a single line of Claude CLI stream-json output into a Token.
/// Returns None if the line is not a recognized event type.
pub fn parse_sse_line(line: &str) -> Option<Token> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    let event: StreamEvent = match serde_json::from_str(trimmed) {
        Ok(e) => e,
        Err(_) => return None,
    };

    match event.event_type.as_str() {
        // Assistant message with content
        "assistant" => {
            if let Some(msg) = event.message {
                let text = extract_text_from_message(&msg.content);
                if !text.is_empty() {
                    return Some(Token::Assistant { text });
                }
            }
            None
        }

        // Content block delta — incremental text output
        "content_block_delta" => {
            if let Some(delta) = event.delta {
                if let Some(text) = delta.text {
                    if !text.is_empty() {
                        return Some(Token::Assistant { text });
                    }
                }
            }
            None
        }

        // Content block start — tool use begins
        "content_block_start" => {
            if let Some(block) = event.content_block {
                if block.block_type.as_deref() == Some("tool_use") {
                    let name = block.name.unwrap_or_default();
                    let input = block
                        .input
                        .map(|v| serde_json::to_string(&v).unwrap_or_default())
                        .unwrap_or_default();
                    return Some(Token::ToolUse { name, input });
                }
            }
            None
        }

        // Tool result from user message
        "user" => {
            if let Some(msg) = event.message {
                if let Some(content) = msg.content {
                    if let Some(tool_results) = content.as_array() {
                        for result in tool_results {
                            if result.get("type").and_then(|t| t.as_str()) == Some("tool_result") {
                                let content_str = result
                                    .get("content")
                                    .and_then(|c| {
                                        if c.is_string() {
                                            c.as_str().map(|s| s.to_string())
                                        } else {
                                            serde_json::to_string_pretty(c).ok()
                                        }
                                    })
                                    .unwrap_or_default();
                                let is_error = result
                                    .get("is_error")
                                    .and_then(|e| e.as_bool())
                                    .unwrap_or(false);
                                return Some(Token::ToolResult {
                                    content: content_str,
                                    is_error,
                                });
                            }
                        }
                    }
                }
            }
            None
        }

        // Result — session completed
        "result" => {
            Some(Token::Done {
                session_id: event.session_id,
                result: event.result,
            })
        }

        // System or init messages — ignore
        "system" | "init" => None,

        // Catch-all: unknown event with error field
        _ => {
            if let Some(err) = event.error {
                Some(Token::Error(err))
            } else {
                None
            }
        }
    }
}

/// Extract human-readable text from a message content value.
fn extract_text_from_message(content: &Option<serde_json::Value>) -> String {
    let content = match content {
        Some(c) => c,
        None => return String::new(),
    };

    match content {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Array(items) => items
            .iter()
            .filter_map(|item| {
                if item.get("type")?.as_str()? == "text" {
                    item.get("text")?.as_str().map(|s| s.to_string())
                } else {
                    None
                }
            })
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_assistant_text() {
        let line = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"Hello world"}]}}"#;
        let token = parse_sse_line(line).unwrap();
        match token {
            Token::Assistant { text } => assert_eq!(text, "Hello world"),
            _ => panic!("Expected Assistant token"),
        }
    }

    #[test]
    fn test_parse_content_block_delta() {
        let line = r#"{"type":"content_block_delta","delta":{"type":"text_delta","text":"partial"}}"#;
        let token = parse_sse_line(line).unwrap();
        match token {
            Token::Assistant { text } => assert_eq!(text, "partial"),
            _ => panic!("Expected Assistant token"),
        }
    }

    #[test]
    fn test_parse_tool_use() {
        let line = r#"{"type":"content_block_start","content_block":{"type":"tool_use","name":"Read","input":{"file_path":"/tmp/test.txt"}}}"#;
        let token = parse_sse_line(line).unwrap();
        match token {
            Token::ToolUse { name, input: _ } => assert_eq!(name, "Read"),
            _ => panic!("Expected ToolUse token"),
        }
    }

    #[test]
    fn test_parse_result() {
        let line = r#"{"type":"result","result":"done","session_id":"abc-123"}"#;
        let token = parse_sse_line(line).unwrap();
        match token {
            Token::Done { session_id, result } => {
                assert_eq!(session_id, Some("abc-123".to_string()));
                assert_eq!(result, Some("done".to_string()));
            }
            _ => panic!("Expected Done token"),
        }
    }

    #[test]
    fn test_parse_empty_line() {
        assert!(parse_sse_line("").is_none());
        assert!(parse_sse_line("  ").is_none());
    }

    #[test]
    fn test_parse_invalid_json() {
        assert!(parse_sse_line("not json").is_none());
    }
}
