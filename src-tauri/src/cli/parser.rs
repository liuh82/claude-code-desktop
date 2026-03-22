use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

// ── Structured data types ────────────────────────────────────────

/// Token usage information from the API.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    #[serde(default)]
    pub input_tokens: u64,
    #[serde(default)]
    pub output_tokens: u64,
    #[serde(default)]
    pub cache_creation_input_tokens: u64,
    #[serde(default)]
    pub cache_read_input_tokens: u64,
}

/// A content block within an assistant message.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ContentBlock {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "tool_use")]
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    #[serde(rename = "thinking")]
    Thinking { thinking: String },
    #[serde(rename = "redacted_thinking")]
    RedactedThinking { data: String },
}

/// The message object inside assistant events.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantMessage {
    pub id: String,
    pub r#type: String,
    pub role: String,
    pub model: String,
    #[serde(default)]
    pub content: Vec<ContentBlock>,
    pub stop_reason: Option<String>,
    pub usage: Option<Usage>,
}

/// Delta types for streaming content blocks.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ContentDelta {
    #[serde(rename = "text_delta")]
    TextDelta { text: String },
    #[serde(rename = "input_json_delta")]
    InputJsonDelta { partial_json: String },
    #[serde(rename = "thinking_delta")]
    ThinkingDelta { thinking: String },
    #[serde(rename = "signature_delta")]
    SignatureDelta { signature: String },
    /// Unknown delta — stored as raw JSON.
    #[serde(rename = "")]
    UnknownDelta { data: serde_json::Value },
}

/// Content block definition from content_block_start.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ContentBlockDef {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "tool_use")]
    ToolUse { id: String, name: String },
    #[serde(rename = "thinking")]
    Thinking { thinking: String },
    #[serde(rename = "redacted_thinking")]
    RedactedThinking { data: String },
}

// ── ClaudeEvent ──────────────────────────────────────────────────

/// Parsed event from Claude CLI's `--output-format stream-json`.
///
/// Each variant corresponds to a `"type"` field value in the JSON output.
/// Unknown/extra fields are silently ignored via `#[serde(flatten)]`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ClaudeEvent {
    /// `{"type":"system","subtype":"init","session_id":"xxx",...}`
    #[serde(rename = "system")]
    System {
        #[serde(default)]
        subtype: Option<String>,
        #[serde(default)]
        session_id: Option<String>,
        #[serde(default, flatten)]
        extra: serde_json::Value,
    },

    /// `{"type":"assistant","message":{...}}`
    #[serde(rename = "assistant")]
    Assistant {
        message: AssistantMessage,
        #[serde(default, flatten)]
        extra: serde_json::Value,
    },

    /// `{"type":"content_block_start","index":0,"content_block":{...}}`
    #[serde(rename = "content_block_start")]
    ContentBlockStart {
        index: u64,
        content_block: ContentBlockDef,
        #[serde(default, flatten)]
        extra: serde_json::Value,
    },

    /// `{"type":"content_block_delta","index":0,"delta":{...}}`
    #[serde(rename = "content_block_delta")]
    ContentBlockDelta {
        index: u64,
        delta: ContentDelta,
        #[serde(default, flatten)]
        extra: serde_json::Value,
    },

    /// `{"type":"content_block_stop","index":0}`
    #[serde(rename = "content_block_stop")]
    ContentBlockStop {
        index: u64,
        #[serde(default, flatten)]
        extra: serde_json::Value,
    },

    /// `{"type":"message_start","message":{...}}`
    #[serde(rename = "message_start")]
    MessageStart {
        message: serde_json::Value,
        #[serde(default, flatten)]
        extra: serde_json::Value,
    },

    /// `{"type":"message_delta","delta":{...},"usage":{...}}`
    #[serde(rename = "message_delta")]
    MessageDelta {
        delta: serde_json::Value,
        #[serde(default)]
        usage: Option<Usage>,
        #[serde(default, flatten)]
        extra: serde_json::Value,
    },

    /// `{"type":"message_stop"}`
    #[serde(rename = "message_stop")]
    MessageStop {
        #[serde(default, flatten)]
        extra: serde_json::Value,
    },

    /// `{"type":"result","subtype":"success","result":"...","session_id":"xxx",...}`
    #[serde(rename = "result")]
    Result {
        #[serde(default)]
        subtype: Option<String>,
        result: String,
        #[serde(default)]
        session_id: Option<String>,
        #[serde(default)]
        cost_usd: Option<f64>,
        #[serde(default)]
        duration_ms: Option<u64>,
        #[serde(default)]
        duration_api_ms: Option<u64>,
        #[serde(default)]
        is_error: Option<bool>,
        #[serde(default)]
        num_turns: Option<u64>,
        #[serde(default)]
        usage: Option<Usage>,
        #[serde(default, flatten)]
        extra: serde_json::Value,
    },

    /// `{"type":"error","error":{...}}`
    #[serde(rename = "error")]
    Error {
        error: serde_json::Value,
        #[serde(default, flatten)]
        extra: serde_json::Value,
    },

}

impl ClaudeEvent {
    /// Extract text from a `content_block_delta` event with `text_delta` delta.
    pub fn as_text_delta(&self) -> Option<&str> {
        match self {
            ClaudeEvent::ContentBlockDelta {
                delta: ContentDelta::TextDelta { text },
                ..
            } => Some(text.as_str()),
            _ => None,
        }
    }

    /// Extract the partial JSON string from an `input_json_delta`.
    pub fn as_input_json_delta(&self) -> Option<&str> {
        match self {
            ClaudeEvent::ContentBlockDelta {
                delta: ContentDelta::InputJsonDelta { partial_json },
                ..
            } => Some(partial_json.as_str()),
            _ => None,
        }
    }

    /// Extract the model name from an `assistant` event.
    pub fn model(&self) -> Option<&str> {
        match self {
            ClaudeEvent::Assistant { message, .. } => Some(&message.model),
            _ => None,
        }
    }

    /// Extract the session ID, if present.
    pub fn session_id(&self) -> Option<&str> {
        match self {
            ClaudeEvent::System { session_id, .. } => session_id.as_deref(),
            ClaudeEvent::Result { session_id, .. } => session_id.as_deref(),
            _ => None,
        }
    }

    /// Check if this event represents a tool use block.
    pub fn is_tool_use(&self) -> bool {
        matches!(
            self,
            ClaudeEvent::ContentBlockStart {
                content_block: ContentBlockDef::ToolUse { .. },
                ..
            }
        )
    }

    /// Extract the tool name from a tool_use content block start, if any.
    pub fn tool_name(&self) -> Option<&str> {
        match self {
            ClaudeEvent::ContentBlockStart {
                content_block: ContentBlockDef::ToolUse { name, .. },
                ..
            } => Some(name.as_str()),
            _ => None,
        }
    }

    /// Check if this event is the final result.
    pub fn is_result(&self) -> bool {
        matches!(self, ClaudeEvent::Result { .. })
    }

    /// Check if this is an error event.
    pub fn is_error(&self) -> bool {
        matches!(self, ClaudeEvent::Error { .. })
    }
}

// ── Line parser ──────────────────────────────────────────────────

/// Parse a single line of stream-json output into a [`ClaudeEvent`].
/// Returns `Ok(None)` for empty or whitespace-only lines.
/// Lines with an unrecognized `"type"` field are logged and skipped.
/// Non-JSON lines return a parse error (logged at debug level).
pub fn parse_line(line: &str) -> AppResult<Option<ClaudeEvent>> {
    let trimmed = line.trim();

    if trimmed.is_empty() {
        return Ok(None);
    }

    match serde_json::from_str::<ClaudeEvent>(trimmed) {
        Ok(event) => Ok(Some(event)),
        Err(e) => {
            // Check if this is a known-type JSON that failed to match our schema
            // vs a completely unknown event type that we should silently skip.
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(trimmed) {
                if v.get("type").is_some() {
                    tracing::debug!(
                        event_type = v.get("type").and_then(|t| t.as_str()),
                        "unrecognized event type, skipping"
                    );
                    return Ok(None);
                }
            }
            tracing::debug!(line = trimmed, error = %e, "non-JSON line from CLI");
            Err(AppError::Cli(format!(
                "Failed to parse stream-json line: {e}"
            )))
        }
    }
}

// ── Tests ────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_empty_line() {
        assert!(parse_line("").unwrap().is_none());
        assert!(parse_line("   \t  ").unwrap().is_none());
    }

    #[test]
    fn test_parse_system_init() {
        let json = r#"{"type":"system","subtype":"init","session_id":"sess-abc","version":"1.0"}"#;
        let event = parse_line(json).unwrap().unwrap();
        match event {
            ClaudeEvent::System {
                subtype,
                session_id,
                ..
            } => {
                assert_eq!(subtype.as_deref(), Some("init"));
                assert_eq!(session_id.as_deref(), Some("sess-abc"));
            }
            _ => panic!("Expected System event, got {:?}", event),
        }
    }

    #[test]
    fn test_parse_assistant() {
        let json = r#"{"type":"assistant","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-sonnet-4-20250514","content":[{"type":"text","text":"Hello!"}],"stop_reason":"end_turn","usage":{"input_tokens":10,"output_tokens":5}}}"#;
        let event = parse_line(json).unwrap().unwrap();
        match &event {
            ClaudeEvent::Assistant { message, .. } => {
                assert_eq!(message.model, "claude-sonnet-4-20250514");
                assert_eq!(message.stop_reason.as_deref(), Some("end_turn"));
                assert_eq!(message.content.len(), 1);
                assert_eq!(event.model().unwrap(), "claude-sonnet-4-20250514");
            }
            _ => panic!("Expected Assistant event"),
        }
    }

    #[test]
    fn test_parse_content_block_start_text() {
        let json = r#"{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}"#;
        let event = parse_line(json).unwrap().unwrap();
        match event {
            ClaudeEvent::ContentBlockStart { index, content_block, .. } => {
                assert_eq!(index, 0);
                assert!(matches!(content_block, ContentBlockDef::Text { .. }));
            }
            _ => panic!("Expected ContentBlockStart"),
        }
    }

    #[test]
    fn test_parse_content_block_start_tool_use() {
        let json = r#"{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_123","name":"Read"}}"#;
        let event = parse_line(json).unwrap().unwrap();
        assert!(event.is_tool_use());
        assert_eq!(event.tool_name().unwrap(), "Read");
    }

    #[test]
    fn test_parse_content_block_delta_text() {
        let json = r#"{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hello world"}}"#;
        let event = parse_line(json).unwrap().unwrap();
        assert_eq!(event.as_text_delta(), Some("hello world"));
    }

    #[test]
    fn test_parse_content_block_delta_input_json() {
        let json = r#"{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"file_path\":\""}}"#;
        let event = parse_line(json).unwrap().unwrap();
        assert_eq!(event.as_input_json_delta().unwrap(), "{\"file_path\":\"");
    }

    #[test]
    fn test_parse_content_block_stop() {
        let json = r#"{"type":"content_block_stop","index":0}"#;
        let event = parse_line(json).unwrap().unwrap();
        match event {
            ClaudeEvent::ContentBlockStop { index, .. } => {
                assert_eq!(index, 0);
            }
            _ => panic!("Expected ContentBlockStop"),
        }
    }

    #[test]
    fn test_parse_result_success() {
        let json = r#"{"type":"result","subtype":"success","result":"Done!","session_id":"sess-xyz","cost_usd":0.05,"duration_ms":1234,"duration_api_ms":1000,"is_error":false,"num_turns":1,"usage":{"input_tokens":100,"output_tokens":200}}"#;
        let event = parse_line(json).unwrap().unwrap();
        match &event {
            ClaudeEvent::Result {
                subtype,
                result,
                session_id,
                cost_usd,
                duration_ms,
                is_error,
                num_turns,
                usage,
                ..
            } => {
                assert_eq!(subtype.as_deref(), Some("success"));
                assert_eq!(result, "Done!");
                assert_eq!(session_id.as_deref(), Some("sess-xyz"));
                assert_eq!(*cost_usd, Some(0.05));
                assert_eq!(*duration_ms, Some(1234));
                assert_eq!(*is_error, Some(false));
                assert_eq!(*num_turns, Some(1));
                let u = usage.as_ref().unwrap();
                assert_eq!(u.input_tokens, 100);
                assert_eq!(u.output_tokens, 200);
            }
            _ => panic!("Expected Result event"),
        }
        assert!(event.is_result());
        assert!(!event.is_error());
        assert_eq!(event.session_id().unwrap(), "sess-xyz");
    }

    #[test]
    fn test_parse_result_minimal() {
        let json = r#"{"type":"result","result":"ok"}"#;
        let event = parse_line(json).unwrap().unwrap();
        match &event {
            ClaudeEvent::Result { result, session_id, .. } => {
                assert_eq!(result, "ok");
                assert!(session_id.is_none());
            }
            _ => panic!("Expected Result event"),
        }
    }

    #[test]
    fn test_parse_error_event() {
        let json = r#"{"type":"error","error":{"type":"api_error","message":"Rate limited"}}"#;
        let event = parse_line(json).unwrap().unwrap();
        assert!(event.is_error());
        match event {
            ClaudeEvent::Error { error, .. } => {
                assert_eq!(error.get("type").and_then(|v| v.as_str()), Some("api_error"));
            }
            _ => panic!("Expected Error event"),
        }
    }

    #[test]
    fn test_parse_message_start() {
        let json = r#"{"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant"}}"#;
        let event = parse_line(json).unwrap().unwrap();
        assert!(matches!(event, ClaudeEvent::MessageStart { .. }));
    }

    #[test]
    fn test_parse_message_delta() {
        let json = r#"{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}"#;
        let event = parse_line(json).unwrap().unwrap();
        match &event {
            ClaudeEvent::MessageDelta { delta, usage, .. } => {
                assert_eq!(delta.get("stop_reason").and_then(|v| v.as_str()), Some("end_turn"));
                assert_eq!(usage.as_ref().unwrap().output_tokens, 5);
            }
            _ => panic!("Expected MessageDelta event"),
        }
    }

    #[test]
    fn test_parse_message_stop() {
        let json = r#"{"type":"message_stop"}"#;
        let event = parse_line(json).unwrap().unwrap();
        assert!(matches!(event, ClaudeEvent::MessageStop { .. }));
    }

    #[test]
    fn test_parse_unknown_type() {
        let json = r#"{"type":"some_future_type","data":123}"#;
        let event = parse_line(json).unwrap();
        // Unknown types are silently skipped (return None).
        assert!(event.is_none());
    }

    #[test]
    fn test_model_and_session_helpers() {
        let assistant = parse_line(
            r#"{"type":"assistant","message":{"id":"m1","type":"message","role":"assistant","model":"claude-opus","content":[],"stop_reason":null,"usage":null}}"#
        ).unwrap().unwrap();
        assert_eq!(assistant.model().unwrap(), "claude-opus");
        assert!(assistant.session_id().is_none());

        let result = parse_line(
            r#"{"type":"result","result":"","session_id":"s1"}"#
        ).unwrap().unwrap();
        assert!(result.model().is_none());
        assert_eq!(result.session_id().unwrap(), "s1");
    }
}
