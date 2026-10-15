//! Wire types shared with the frontend. They mirror `src/runtime/process/types.ts`
//! (`ProcessEnd`, `ProgramLocation`) and `src/runtime/process/protocol.ts`
//! (`BridgeMessage`, `BridgeRunRequest`), so the dev bridge and the desktop app
//! speak the same format. `src/runtime/process/protocol.cases.json` pins it for
//! both test suites.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SpawnErrorCode {
    NotFound,
    Denied,
    HostUnavailable,
    Failed,
}

/// How a process run ended; exactly one per run.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ProcessEnd {
    Exit {
        code: Option<i32>,
        signal: Option<String>,
    },
    Timeout {
        #[serde(rename = "timeoutMs")]
        timeout_ms: u64,
    },
    Cancelled,
    SpawnError {
        code: SpawnErrorCode,
        message: String,
    },
}

impl ProcessEnd {
    pub fn denied(message: impl Into<String>) -> Self {
        ProcessEnd::SpawnError {
            code: SpawnErrorCode::Denied,
            message: message.into(),
        }
    }
}

/// What the frontend receives over the run's channel, in order:
/// `spawn`?, then `out` / `err` chunks, then exactly one `end`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "t", rename_all = "lowercase")]
pub enum ProcessMessage {
    Spawn,
    Out { d: String },
    Err { d: String },
    End { end: ProcessEnd },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRequest {
    /// logical program id (e.g. "claude"), never a path
    pub program: String,
    pub args: Vec<String>,
    pub stdin: Option<String>,
    pub cwd: Option<String>,
    /// extra variables; the program decides which (if any) are allowed
    pub env: Option<std::collections::BTreeMap<String, String>>,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ProgramLocation {
    pub found: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    const CASES: &str = include_str!("../../../src/runtime/process/protocol.cases.json");

    /// the Rust values, in the same order as the shared fixture's `messages`
    fn rust_messages() -> Vec<ProcessMessage> {
        vec![
            ProcessMessage::Spawn,
            ProcessMessage::Out {
                d: "{\"type\":\"system\"}\n".into(),
            },
            ProcessMessage::Err { d: "warn\n".into() },
            ProcessMessage::End {
                end: ProcessEnd::Exit {
                    code: Some(0),
                    signal: None,
                },
            },
            ProcessMessage::End {
                end: ProcessEnd::Exit {
                    code: None,
                    signal: Some("killed".into()),
                },
            },
            ProcessMessage::End {
                end: ProcessEnd::Timeout { timeout_ms: 3000 },
            },
            ProcessMessage::End {
                end: ProcessEnd::Cancelled,
            },
            ProcessMessage::End {
                end: ProcessEnd::SpawnError {
                    code: SpawnErrorCode::NotFound,
                    message: "claude was not found".into(),
                },
            },
            ProcessMessage::End {
                end: ProcessEnd::denied("argument not allowed: --x"),
            },
        ]
    }

    #[test]
    fn messages_serialize_exactly_like_the_typescript_protocol() {
        let cases: Value = serde_json::from_str(CASES).unwrap();
        let expected = cases["messages"].as_array().unwrap();
        let actual: Vec<Value> = rust_messages()
            .iter()
            .map(|m| serde_json::to_value(m).unwrap())
            .collect();
        assert_eq!(&actual, expected);
    }

    #[test]
    fn run_requests_deserialize_from_the_typescript_shape() {
        let cases: Value = serde_json::from_str(CASES).unwrap();
        let r: RunRequest = serde_json::from_value(cases["request"].clone()).unwrap();
        assert_eq!(r.program, "claude");
        assert_eq!(r.args, vec!["--version".to_string()]);
        assert_eq!(r.stdin.as_deref(), Some("hello"));
        assert_eq!(r.timeout_ms, Some(20000));
        assert_eq!(r.cwd, None);
    }

    #[test]
    fn locations_serialize_without_missing_fields() {
        let cases: Value = serde_json::from_str(CASES).unwrap();
        let found = ProgramLocation {
            found: true,
            path: Some("C:\\claude.exe".into()),
            source: Some("path".into()),
        };
        let missing = ProgramLocation {
            found: false,
            path: None,
            source: None,
        };
        assert_eq!(serde_json::to_value(&found).unwrap(), cases["locations"][0]);
        assert_eq!(
            serde_json::to_value(&missing).unwrap(),
            cases["locations"][1]
        );
    }
}
