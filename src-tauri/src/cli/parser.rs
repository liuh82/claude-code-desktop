use crate::error::{AppError, AppResult};

/// Parsed event from Claude CLI's stream-json output.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type")]
pub enum ClaudeEvent {
    /// System-level message (e.g., startup info).
    #[serde(rename = "system")]
    System { message: String },

    /// Assistant thinking content.
    #[serde(rename = "assistant")]
    Assistant { message: serde_json::Value },

    /// Start of a content block (text, tool_use, etc.).
    #[serde(rename = "content_block_start")]
    ContentBlockStart { content_block: serde_json::Value },

    /// Delta for a streaming content block.
    #[serde(rename = "content_block_delta")]
    ContentBlockDelta { delta: serde_json::Value },

    /// End of a content block.
    #[serde(rename = "content_block_stop")]
    ContentBlockStop,

    /// Final result of the interaction.
    #[serde(rename = "result")]
    Result {
        result: String,
        session_id: Option<String>,
    },

    /// An error occurred.
    #[serde(rename = "error")]
    Error { error: String },
}

impl ClaudeEvent {
    /// Extract text from a content_block_delta event, if applicable.
    pub fn as_text_delta(&self) -> Option<&str> {
        match self {
            ClaudeEvent::ContentBlockDelta { delta } => {
                delta.get("text")?.as_str()
            }
            _ => None,
        }
    }

    /// Check if this event represents a tool use.
    pub fn is_tool_use(&self) -> bool {
        matches!(
            self,
            ClaudeEvent::ContentBlockStart { content_block } if content_block.get("type").and_then(|t| t.as_str()) == Some("tool_use")
        )
    }
}

/// Parse a single line of stream-json output into a ClaudeEvent.
/// Returns `Ok(None)` for empty lines or non-JSON lines.
pub fn parse_line(line: &str) -> AppResult<Option<ClaudeEvent>> {
    let trimmed = line.trim();

    if trimmed.is_empty() {
        return Ok(None);
    }

    // Try to parse as JSON
    let event: ClaudeEvent = match serde_json::from_str(trimmed) {
        Ok(e) => e,
        Err(e) => {
            // Not valid JSON — could be a raw text line from stderr.
            // Return as a system message.
            tracing::debug!("non-JSON line: {}", trimmed);
            return Err(AppError::Cli(format!(
                "Failed to parse stream-json line: {}",
                e
            )));
        }
    };

    Ok(Some(event))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_empty_line() {
        assert!(parse_line("").unwrap().is_none());
        assert!(parse_line("   ").unwrap().is_none());
    }

    #[test]
    fn test_parse_result_event() {
        let json = r#"{"type":"result","result":"Done","session_id":"abc-123"}"#;
        let event = parse_line(json).unwrap().unwrap();
        match event {
            ClaudeEvent::Result { result, session_id } => {
                assert_eq!(result, "Done");
                assert_eq!(session_id, Some("abc-123".to_string()));
            }
            _ => panic!("Expected Result event"),
        }
    }

    #[test]
    fn test_parse_content_block_delta() {
        let json = r#"{"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}}"#;
        let event = parse_line(json).unwrap().unwrap();
        assert_eq!(event.as_text_delta(), Some("hello"));
    }
}
