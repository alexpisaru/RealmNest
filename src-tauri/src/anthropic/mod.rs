//! The Anthropic API (Messages), called from Rust only. Like OpenRouter: the webview never
//! holds the API key; commands take a connection id and this module reads
//! `conn.<id>.apiKey` from the OS credential store.
//!
//! Safety:
//! - one fixed origin (https://api.anthropic.com/v1), fixed paths, HTTPS only, no redirects
//! - typed, size-limited requests (content blocks are checked); size-limited streams
//! - connect, idle and total timeouts; cancellation by run id
//! - errors normalized and redacted; nothing logs headers or bodies
//!
//! The stream is reported with the same events as OpenRouter (`StreamEvent`), so the
//! frontend handles both the same way.

use crate::openrouter::sse::{SseItem, SseParser};
use crate::openrouter::{
    redact, search_hit, EventSink, OrError, SearchHit, StreamEvent, Validation,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::watch;

pub const BASE: &str = "https://api.anthropic.com/v1";
const VERSION: &str = "2023-06-01";
const MAX_REQUEST_BYTES: usize = 24_000_000;
const MAX_MESSAGES: usize = 1_000;
const MAX_BLOCKS: usize = 64;
const MAX_TOOLS: usize = 32;
const MAX_TOOL_SCHEMA_BYTES: usize = 16 * 1024;
const MAX_TOOL_CALLS: usize = 16;
const MAX_TOOL_ARGS_BYTES: usize = 256 * 1024 + 4096;
const MAX_ERROR_BODY: usize = 64 * 1024;
const MAX_CATALOG_BYTES: usize = 4 * 1024 * 1024;
const MAX_STREAM_BYTES: usize = 16 * 1024 * 1024;
const MAX_SSE_LINE: usize = 1024 * 1024;
const IDLE_TIMEOUT: Duration = Duration::from_secs(120);
const DEFAULT_TOTAL_TIMEOUT_MS: u64 = 5 * 60_000;
const MAX_TOTAL_TIMEOUT_MS: u64 = 30 * 60_000;
const DEFAULT_MAX_TOKENS: u32 = 8_192;

/// One turn, already in the Messages API's shape (snake_case), as the frontend sends it.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct MessagesRequest {
    pub model: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    pub messages: Vec<Message>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tools: Vec<ToolSpec>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    /// RealmNest's own limit, not sent
    #[serde(default, skip_serializing)]
    pub timeout_ms: Option<u64>,
    /// Anthropic's server web_search tool with at most this many searches (billed per search)
    #[serde(default, skip_serializing)]
    pub web_search: Option<u32>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Message {
    pub role: String,
    pub content: Vec<Block>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Block {
    Text {
        text: String,
    },
    Image {
        source: Source,
    },
    Document {
        source: Source,
    },
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    ToolResult {
        tool_use_id: String,
        content: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        is_error: Option<bool>,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Source {
    #[serde(rename = "type")]
    pub kind: String,
    pub media_type: String,
    pub data: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ToolSpec {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnthropicModel {
    pub id: String,
    pub label: String,
    pub provider_label: String,
    pub input_modalities: Vec<String>,
    pub output_modalities: Vec<String>,
    pub supported_parameters: Vec<String>,
}

fn is_model_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "._:-".contains(c))
}

fn is_tool_name(n: &str) -> bool {
    !n.is_empty()
        && n.len() <= 128
        && n.chars()
            .all(|c| c.is_ascii_alphanumeric() || "_-".contains(c))
}

fn err(code: &str, message: impl Into<String>, status: Option<u16>) -> OrError {
    OrError {
        code: code.into(),
        message: redact(&message.into()),
        status,
    }
}

/// The request's rules, checked before anything is sent.
pub fn check_request(req: &MessagesRequest) -> Result<(), OrError> {
    let bad = |m: &str| Err(err("bad_request", m.to_string(), None));
    if !is_model_id(&req.model) {
        return bad("Choose a valid Claude model.");
    }
    if req.messages.is_empty() || req.messages.len() > MAX_MESSAGES {
        return bad("The conversation is empty or too long.");
    }
    if req.tools.len() > MAX_TOOLS {
        return bad("Too many tools for one turn.");
    }
    for t in &req.tools {
        if !is_tool_name(&t.name)
            || t.description.len() > 4096
            || serde_json::to_vec(&t.input_schema)
                .map(|v| v.len())
                .unwrap_or(usize::MAX)
                > MAX_TOOL_SCHEMA_BYTES
            || !t.input_schema.is_object()
        {
            return bad("A tool definition is not valid.");
        }
    }
    for m in &req.messages {
        if m.role != "user" && m.role != "assistant" {
            return bad("Only user and assistant messages are allowed.");
        }
        if m.content.is_empty() || m.content.len() > MAX_BLOCKS {
            return bad("A message has no content or too many parts.");
        }
        for b in &m.content {
            match b {
                Block::Image { source } => {
                    if source.kind != "base64"
                        || !["image/png", "image/jpeg", "image/gif", "image/webp"]
                            .contains(&source.media_type.as_str())
                    {
                        return bad("Only PNG, JPEG, GIF and WebP images can be sent.");
                    }
                }
                Block::Document { source } => {
                    if source.kind != "base64" || source.media_type != "application/pdf" {
                        return bad("Only PDF documents can be sent.");
                    }
                }
                Block::ToolUse { id, name, .. } => {
                    if id.is_empty() || id.len() > 256 || !is_tool_name(name) {
                        return bad("A tool call is not valid.");
                    }
                }
                Block::ToolResult { tool_use_id, .. } => {
                    if tool_use_id.is_empty() || tool_use_id.len() > 256 {
                        return bad("A tool result is not valid.");
                    }
                }
                Block::Text { .. } => {}
            }
        }
    }
    if let Some(t) = req.temperature {
        if !(0.0..=1.0).contains(&t) {
            return bad("The temperature must be between 0 and 1.");
        }
    }
    let size = serde_json::to_vec(req)
        .map(|v| v.len())
        .unwrap_or(usize::MAX);
    if size > MAX_REQUEST_BYTES {
        return Err(err(
            "too_large",
            "The message and its attachments are too large.",
            None,
        ));
    }
    Ok(())
}

fn http_error(status: u16, body: &[u8]) -> OrError {
    let said = serde_json::from_slice::<serde_json::Value>(body)
        .ok()
        .and_then(|j| j["error"]["message"].as_str().map(String::from))
        .unwrap_or_default();
    let (code, fallback) = match status {
        400 => ("bad_request", "Anthropic refused the request."),
        401 => ("invalid_credentials", "Anthropic rejected the API key."),
        402 => (
            "payment_required",
            "This Anthropic account has no credit left.",
        ),
        403 => (
            "forbidden",
            "This API key cannot do that (permissions or limits).",
        ),
        404 => (
            "model_unavailable",
            "This model is not available with this key.",
        ),
        408 => ("timeout", "Anthropic timed out."),
        413 => ("too_large", "The request is too large for Anthropic."),
        429 => (
            "rate_limited",
            "Anthropic is rate limiting this key; try again shortly.",
        ),
        500 | 502 | 503 | 529 => (
            "provider_unavailable",
            "Anthropic is overloaded or unavailable right now.",
        ),
        _ => ("unknown", "Anthropic returned an error."),
    };
    let message = if said.is_empty() || status >= 500 {
        fallback.to_string()
    } else {
        format!("{fallback} ({said})")
    };
    err(code, message, Some(status))
}

fn network_message(e: &reqwest::Error) -> String {
    if e.is_timeout() {
        "Anthropic did not answer in time.".into()
    } else if e.is_connect() {
        "Could not reach Anthropic (network or firewall).".into()
    } else {
        "The connection to Anthropic failed.".into()
    }
}

async fn read_limited(mut resp: reqwest::Response, max: usize) -> Result<Vec<u8>, ()> {
    let mut out = Vec::new();
    while let Some(chunk) = resp.chunk().await.map_err(|_| ())? {
        out.extend_from_slice(&chunk);
        if out.len() > max {
            return Err(());
        }
    }
    Ok(out)
}

async fn cancelled(rx: &mut watch::Receiver<bool>) {
    loop {
        if *rx.borrow() {
            return;
        }
        if rx.changed().await.is_err() {
            std::future::pending::<()>().await;
        }
    }
}

/// Anthropic's stop reasons, in the words the frontend already knows (OpenAI style)
fn finish_reason(stop: &str) -> String {
    match stop {
        "end_turn" | "stop_sequence" => "stop",
        "tool_use" => "tool_calls",
        "max_tokens" => "length",
        "refusal" => "content_filter",
        // a long server-tool turn paused by the API: what came so far is the answer
        "pause_turn" => "stop",
        other => other,
    }
    .to_string()
}

#[derive(Default)]
struct Pending {
    id: String,
    name: String,
    args: String,
}

/// Turns the Messages stream into StreamEvents; returns the final event when the stream ends.
#[derive(Default)]
pub struct StreamState {
    started: bool,
    calls: HashMap<u64, Pending>,
    order: Vec<u64>,
    input_tokens: u64,
    output_tokens: u64,
    finish: Option<String>,
    /// the server web_search calls (id → query as it streams in)
    searches: HashMap<u64, (String, String)>,
}

impl StreamState {
    /// one SSE data document; Some(end) when the stream is finished (or failed)
    pub fn feed(&mut self, v: &serde_json::Value, sink: &dyn EventSink) -> Option<StreamEvent> {
        match v["type"].as_str().unwrap_or("") {
            "message_start" => {
                self.input_tokens = v["message"]["usage"]["input_tokens"].as_u64().unwrap_or(0);
                if !self.started {
                    self.started = true;
                    sink.send(StreamEvent::Start {
                        model: v["message"]["model"].as_str().map(String::from),
                    });
                }
            }
            "content_block_start" => {
                let block = &v["content_block"];
                if block["type"] == "server_tool_use" {
                    let index = v["index"].as_u64().unwrap_or(0);
                    let start = block["input"]["query"].as_str().unwrap_or("").to_string();
                    self.searches.insert(
                        index,
                        (block["id"].as_str().unwrap_or("").to_string(), start),
                    );
                }
                if block["type"] == "web_search_tool_result" {
                    let id = block["tool_use_id"].as_str().unwrap_or("");
                    let query = self
                        .searches
                        .values()
                        .find(|(sid, _)| sid == id)
                        .map(|(_, q)| q.clone())
                        .and_then(|q| {
                            // the input streamed as JSON text: {"query": "…"}
                            serde_json::from_str::<serde_json::Value>(&q)
                                .ok()
                                .and_then(|j| j["query"].as_str().map(String::from))
                                .or(Some(q))
                                .filter(|q| !q.is_empty())
                        });
                    let results: Vec<SearchHit> = block["content"]
                        .as_array()
                        .map(|a| a.as_slice())
                        .unwrap_or_default()
                        .iter()
                        .filter_map(|r| {
                            search_hit(
                                r["url"].as_str(),
                                r["title"].as_str(),
                                None,
                                r["page_age"].as_str(),
                            )
                        })
                        .take(20)
                        .collect();
                    sink.send(StreamEvent::Search { query, results });
                }
                if block["type"] == "tool_use" {
                    if self.calls.len() >= MAX_TOOL_CALLS {
                        return Some(StreamEvent::Error(err(
                            "malformed",
                            "The model asked for too many tools at once.",
                            None,
                        )));
                    }
                    let index = v["index"].as_u64().unwrap_or(0);
                    let name = block["name"].as_str().unwrap_or("").to_string();
                    if !is_tool_name(&name) {
                        return Some(StreamEvent::Error(err(
                            "malformed",
                            "The model asked for a tool with an invalid name.",
                            None,
                        )));
                    }
                    self.calls.insert(
                        index,
                        Pending {
                            id: block["id"]
                                .as_str()
                                .unwrap_or("")
                                .chars()
                                .take(256)
                                .collect(),
                            name,
                            args: String::new(),
                        },
                    );
                    self.order.push(index);
                }
            }
            "content_block_delta" => {
                let d = &v["delta"];
                match d["type"].as_str().unwrap_or("") {
                    "text_delta" => {
                        if let Some(t) = d["text"].as_str().filter(|t| !t.is_empty()) {
                            sink.send(StreamEvent::Delta { d: t.to_string() });
                        }
                    }
                    "input_json_delta" => {
                        let index = v["index"].as_u64().unwrap_or(0);
                        if let Some((_, q)) = self.searches.get_mut(&index) {
                            if q.len() < 2000 {
                                q.push_str(d["partial_json"].as_str().unwrap_or(""));
                            }
                        }
                        if let Some(c) = self.calls.get_mut(&index) {
                            c.args.push_str(d["partial_json"].as_str().unwrap_or(""));
                            if c.args.len() > MAX_TOOL_ARGS_BYTES {
                                return Some(StreamEvent::Error(err(
                                    "too_large",
                                    "A tool request from the model was too large.",
                                    None,
                                )));
                            }
                        }
                    }
                    // thinking and signatures stay with Anthropic
                    _ => {}
                }
            }
            "message_delta" => {
                if let Some(s) = v["delta"]["stop_reason"].as_str() {
                    self.finish = Some(finish_reason(s));
                }
                if let Some(o) = v["usage"]["output_tokens"].as_u64() {
                    self.output_tokens = o;
                }
            }
            "message_stop" => return Some(self.done(sink)),
            "error" => {
                let kind = v["error"]["type"].as_str().unwrap_or("");
                let status = match kind {
                    "overloaded_error" => 529,
                    "rate_limit_error" => 429,
                    "invalid_request_error" => 400,
                    "authentication_error" => 401,
                    "permission_error" => 403,
                    "not_found_error" => 404,
                    "request_too_large" => 413,
                    _ => 500,
                };
                let body = serde_json::json!({ "error": { "message": v["error"]["message"].as_str().unwrap_or("") } }).to_string();
                return Some(StreamEvent::Error(http_error(status, body.as_bytes())));
            }
            _ => {} // ping and anything new
        }
        None
    }

    fn done(&mut self, sink: &dyn EventSink) -> StreamEvent {
        sink.send(StreamEvent::Usage {
            prompt: self.input_tokens,
            completion: self.output_tokens,
            cost: None,
        });
        for i in &self.order {
            if let Some(c) = self.calls.get(i) {
                sink.send(StreamEvent::Tool {
                    id: c.id.clone(),
                    name: c.name.clone(),
                    // a tool with no input streams nothing: that is an empty object
                    args: if c.args.trim().is_empty() {
                        "{}".into()
                    } else {
                        c.args.clone()
                    },
                });
            }
        }
        StreamEvent::Done {
            finish_reason: self.finish.clone(),
        }
    }
}

pub struct Client {
    http: reqwest::Client,
    base: String,
}

impl Client {
    pub fn new() -> Self {
        Self::with_base(BASE, true)
    }

    pub fn with_base(base: &str, https_only: bool) -> Self {
        let http = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .https_only(https_only)
            .connect_timeout(Duration::from_secs(15))
            .user_agent("RealmNest")
            .build()
            .expect("HTTP client");
        Client {
            http,
            base: base.trim_end_matches('/').to_string(),
        }
    }

    fn get(&self, path: &str, key: &str) -> reqwest::RequestBuilder {
        self.http
            .get(format!("{}{path}", self.base))
            .header("x-api-key", key)
            .header("anthropic-version", VERSION)
            .timeout(Duration::from_secs(30))
    }

    /// Cheap check of the key: list one model.
    pub async fn validate(&self, key: Option<String>) -> Validation {
        let v = |status: &str, message: &str| Validation {
            status: status.into(),
            message: message.into(),
            free_tier: None,
        };
        let Some(key) = key else {
            return v("missing_key", "No API key is stored for this connection.");
        };
        match self.get("/models?limit=1", &key).send().await {
            Ok(r) if r.status().as_u16() == 200 => {
                v("connected", "Anthropic accepted the API key.")
            }
            Ok(r) if r.status().as_u16() == 401 => {
                v("invalid_credentials", "Anthropic rejected the API key.")
            }
            Ok(r) => {
                let s = r.status().as_u16();
                let body = read_limited(r, MAX_ERROR_BODY).await.unwrap_or_default();
                v("error", &http_error(s, &body).message)
            }
            Err(e) => v("unavailable", &network_message(&e)),
        }
    }

    /// The models this key can use (`GET /models`).
    pub async fn models(&self, key: Option<String>) -> Result<Vec<AnthropicModel>, OrError> {
        let key = key.ok_or_else(|| {
            err(
                "missing_key",
                "No API key is stored for this connection.",
                None,
            )
        })?;
        let r = self
            .get("/models?limit=1000", &key)
            .send()
            .await
            .map_err(|e| err("network", network_message(&e), None))?;
        let status = r.status().as_u16();
        let body = read_limited(r, MAX_CATALOG_BYTES)
            .await
            .map_err(|_| err("too_large", "The model list was too large.", None))?;
        if status != 200 {
            return Err(http_error(status, &body));
        }
        let j: serde_json::Value = serde_json::from_slice(&body)
            .map_err(|_| err("malformed", "The model list could not be read.", None))?;
        Ok(j["data"]
            .as_array()
            .map(|a| a.as_slice())
            .unwrap_or_default()
            .iter()
            .filter_map(|m| {
                let id = m["id"].as_str()?;
                is_model_id(id).then(|| AnthropicModel {
                    id: id.to_string(),
                    label: m["display_name"]
                        .as_str()
                        .unwrap_or(id)
                        .chars()
                        .take(120)
                        .collect(),
                    provider_label: "anthropic".into(),
                    input_modalities: vec!["text".into(), "image".into(), "file".into()],
                    output_modalities: vec!["text".into()],
                    supported_parameters: vec!["tools".into()],
                })
            })
            .collect())
    }

    /// Stream one turn; always ends with exactly one done / error / cancelled.
    pub async fn chat(
        &self,
        key: Option<String>,
        req: MessagesRequest,
        sink: &dyn EventSink,
        mut cancel: watch::Receiver<bool>,
    ) {
        let end = self.chat_inner(key, req, sink, &mut cancel).await;
        sink.send(end);
    }

    async fn chat_inner(
        &self,
        key: Option<String>,
        mut req: MessagesRequest,
        sink: &dyn EventSink,
        cancel: &mut watch::Receiver<bool>,
    ) -> StreamEvent {
        let Some(key) = key else {
            return StreamEvent::Error(err(
                "missing_key",
                "No API key is stored for this connection.",
                None,
            ));
        };
        if let Err(e) = check_request(&req) {
            return StreamEvent::Error(e);
        }
        req.max_tokens = Some(
            req.max_tokens
                .unwrap_or(DEFAULT_MAX_TOKENS)
                .clamp(1, 64_000),
        );
        let total = Duration::from_millis(
            req.timeout_ms
                .unwrap_or(DEFAULT_TOTAL_TIMEOUT_MS)
                .clamp(1_000, MAX_TOTAL_TIMEOUT_MS),
        );
        let deadline = tokio::time::Instant::now() + total;
        let mut body = serde_json::to_value(&req).unwrap_or_default();
        body["stream"] = serde_json::Value::Bool(true);
        if let Some(n) = req.web_search {
            let tool = serde_json::json!({ "type": "web_search_20250305", "name": "web_search", "max_uses": n.clamp(1, 10) });
            match body["tools"].as_array_mut() {
                Some(a) => a.push(tool),
                None => body["tools"] = serde_json::json!([tool]),
            }
        }
        let send = self
            .http
            .post(format!("{}/messages", self.base))
            .header("x-api-key", key)
            .header("anthropic-version", VERSION)
            .json(&body)
            .send();
        let resp = tokio::select! {
            r = send => r,
            _ = cancelled(cancel) => return StreamEvent::Cancelled,
            _ = tokio::time::sleep_until(deadline) => return StreamEvent::Error(err("timeout", "Anthropic did not answer in time.", None)),
        };
        let mut resp = match resp {
            Ok(r) => r,
            Err(e) => {
                return StreamEvent::Error(err(
                    if e.is_timeout() { "timeout" } else { "network" },
                    network_message(&e),
                    None,
                ))
            }
        };
        let status = resp.status().as_u16();
        if status != 200 {
            // the error body too stops with Stop, the deadline, or a silent server
            let raw = tokio::select! {
                r = tokio::time::timeout(IDLE_TIMEOUT, read_limited(resp, MAX_ERROR_BODY)) => r.ok().and_then(Result::ok).unwrap_or_default(),
                _ = cancelled(cancel) => return StreamEvent::Cancelled,
                _ = tokio::time::sleep_until(deadline) => Vec::new(),
            };
            return StreamEvent::Error(http_error(status, &raw));
        }
        let mut parser = SseParser::new(MAX_SSE_LINE);
        let mut state = StreamState::default();
        let mut received = 0usize;
        loop {
            let chunk = tokio::select! {
                c = tokio::time::timeout(IDLE_TIMEOUT, resp.chunk()) => c,
                _ = cancelled(cancel) => return StreamEvent::Cancelled,
                _ = tokio::time::sleep_until(deadline) => return StreamEvent::Error(err("timeout", "The reply took too long and was stopped.", None)),
            };
            let bytes = match chunk {
                Err(_) => {
                    return StreamEvent::Error(err(
                        "timeout",
                        "Anthropic stopped sending data.",
                        None,
                    ))
                }
                Ok(Err(e)) => return StreamEvent::Error(err("network", network_message(&e), None)),
                Ok(Ok(None)) => {
                    return StreamEvent::Error(err(
                        "malformed",
                        "The reply ended before it was complete.",
                        None,
                    ))
                }
                Ok(Ok(Some(b))) => b,
            };
            received += bytes.len();
            if received > MAX_STREAM_BYTES {
                return StreamEvent::Error(err(
                    "too_large",
                    "The reply was too large and was stopped.",
                    None,
                ));
            }
            let items = match parser.push(&bytes) {
                Ok(i) => i,
                Err(_) => {
                    return StreamEvent::Error(err(
                        "malformed",
                        "Anthropic sent a line RealmNest could not read.",
                        None,
                    ))
                }
            };
            for item in items {
                if let SseItem::Data(json) = item {
                    let Ok(v) = serde_json::from_str::<serde_json::Value>(&json) else {
                        continue;
                    };
                    if let Some(end) = state.feed(&v, sink) {
                        return end;
                    }
                }
            }
        }
    }
}

impl Default for Client {
    fn default() -> Self {
        Self::new()
    }
}

pub struct AnthropicHost {
    pub client: Client,
    runs: Mutex<HashMap<String, watch::Sender<bool>>>,
    counter: AtomicU64,
}

impl AnthropicHost {
    pub fn new(client: Client) -> Arc<Self> {
        Arc::new(AnthropicHost {
            client,
            runs: Mutex::new(HashMap::new()),
            counter: AtomicU64::new(0),
        })
    }

    pub fn start(
        self: &Arc<Self>,
        key: Option<String>,
        req: MessagesRequest,
        sink: Arc<dyn EventSink>,
    ) -> String {
        let id = format!("an{}", self.counter.fetch_add(1, Ordering::SeqCst) + 1);
        let (tx, rx) = watch::channel(false);
        self.runs.lock().unwrap().insert(id.clone(), tx);
        let host = self.clone();
        let rid = id.clone();
        tauri::async_runtime::spawn(async move {
            host.client.chat(key, req, sink.as_ref(), rx).await;
            host.runs.lock().unwrap().remove(&rid);
        });
        id
    }

    pub fn cancel(&self, id: &str) -> bool {
        match self.runs.lock().unwrap().get(id) {
            Some(tx) => tx.send(true).is_ok(),
            None => false,
        }
    }

    pub fn cancel_all(&self) {
        for tx in self.runs.lock().unwrap().values() {
            let _ = tx.send(true);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex as StdMutex;

    struct Collect(StdMutex<Vec<StreamEvent>>);
    impl EventSink for Collect {
        fn send(&self, e: StreamEvent) {
            self.0.lock().unwrap().push(e);
        }
    }

    fn feed_all(lines: &[&str]) -> (Vec<StreamEvent>, Option<StreamEvent>) {
        let sink = Collect(StdMutex::new(Vec::new()));
        let mut st = StreamState::default();
        let mut end = None;
        for l in lines {
            let v: serde_json::Value = serde_json::from_str(l).unwrap();
            if let Some(e) = st.feed(&v, &sink) {
                end = Some(e);
                break;
            }
        }
        (sink.0.into_inner().unwrap(), end)
    }

    #[test]
    fn text_stream_with_usage() {
        let (events, end) = feed_all(&[
            r#"{"type":"message_start","message":{"model":"claude-sonnet-5-5","usage":{"input_tokens":12}}}"#,
            r#"{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}"#,
            r#"{"type":"ping"}"#,
            r#"{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hel"}}"#,
            r#"{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"lo"}}"#,
            r#"{"type":"content_block_stop","index":0}"#,
            r#"{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":3}}"#,
            r#"{"type":"message_stop"}"#,
        ]);
        assert_eq!(
            events,
            vec![
                StreamEvent::Start {
                    model: Some("claude-sonnet-5-5".into())
                },
                StreamEvent::Delta { d: "Hel".into() },
                StreamEvent::Delta { d: "lo".into() },
                StreamEvent::Usage {
                    prompt: 12,
                    completion: 3,
                    cost: None
                },
            ]
        );
        assert_eq!(
            end,
            Some(StreamEvent::Done {
                finish_reason: Some("stop".into())
            })
        );
    }

    #[test]
    fn tool_calls_are_assembled_and_sent_before_done() {
        let (events, end) = feed_all(&[
            r#"{"type":"message_start","message":{"model":"m","usage":{"input_tokens":1}}}"#,
            r#"{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_1","name":"web_fetch","input":{}}}"#,
            r#"{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"url\": \"https://ex"}}"#,
            r#"{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"ample.com\"}"}}"#,
            r#"{"type":"content_block_start","index":2,"content_block":{"type":"tool_use","id":"toolu_2","name":"get_current_time","input":{}}}"#,
            r#"{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":9}}"#,
            r#"{"type":"message_stop"}"#,
        ]);
        assert!(events.contains(&StreamEvent::Tool {
            id: "toolu_1".into(),
            name: "web_fetch".into(),
            args: r#"{"url": "https://example.com"}"#.into()
        }));
        assert!(events.contains(&StreamEvent::Tool {
            id: "toolu_2".into(),
            name: "get_current_time".into(),
            args: "{}".into()
        }));
        assert_eq!(
            end,
            Some(StreamEvent::Done {
                finish_reason: Some("tool_calls".into())
            })
        );
    }

    #[test]
    fn server_web_search_results_become_search_events() {
        let (events, end) = feed_all(&[
            r#"{"type":"message_start","message":{"model":"m","usage":{"input_tokens":5}}}"#,
            r#"{"type":"content_block_start","index":0,"content_block":{"type":"server_tool_use","id":"srvtoolu_1","name":"web_search","input":{}}}"#,
            r#"{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"query\": \"tauri 2 audit\"}"}}"#,
            r#"{"type":"content_block_start","index":1,"content_block":{"type":"web_search_tool_result","tool_use_id":"srvtoolu_1","content":[{"type":"web_search_result","url":"https://tauri.app/blog/","title":"Tauri blog","page_age":"May 2, 2025","encrypted_content":"x"},{"type":"web_search_result","url":"javascript:alert(1)","title":"bad"}]}}"#,
            r#"{"type":"content_block_start","index":2,"content_block":{"type":"text","text":""}}"#,
            r#"{"type":"content_block_delta","index":2,"delta":{"type":"text_delta","text":"done"}}"#,
            r#"{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":2}}"#,
            r#"{"type":"message_stop"}"#,
        ]);
        assert!(events.contains(&StreamEvent::Search {
            query: Some("tauri 2 audit".into()),
            results: vec![SearchHit {
                url: "https://tauri.app/blog/".into(),
                title: Some("Tauri blog".into()),
                snippet: None,
                published: Some("May 2, 2025".into())
            }],
        }));
        assert!(!events.iter().any(|e| matches!(e, StreamEvent::Tool { .. })));
        assert_eq!(
            end,
            Some(StreamEvent::Done {
                finish_reason: Some("stop".into())
            })
        );
    }

    #[test]
    fn stream_errors_are_normalized() {
        let (_, end) = feed_all(&[
            r#"{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}"#,
        ]);
        match end {
            Some(StreamEvent::Error(e)) => assert_eq!(e.code, "provider_unavailable"),
            other => panic!("{other:?}"),
        }
        let (_, end) = feed_all(&[
            r#"{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"x","name":"rm -rf"}}"#,
        ]);
        assert!(matches!(end, Some(StreamEvent::Error(_))));
    }

    #[test]
    fn requests_are_checked() {
        let ok: MessagesRequest = serde_json::from_str(r#"{"model":"claude-sonnet-5-5","system":"s","messages":[{"role":"user","content":[{"type":"text","text":"hi"},{"type":"image","source":{"type":"base64","media_type":"image/png","data":"AAAA"}}]},{"role":"assistant","content":[{"type":"tool_use","id":"t1","name":"web_fetch","input":{"url":"x"}}]},{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":"page"}]}],"tools":[{"name":"web_fetch","description":"d","input_schema":{"type":"object"}}]}"#).unwrap();
        assert!(check_request(&ok).is_ok());
        let mut bad = ok.clone();
        bad.model = "../etc".into();
        assert!(check_request(&bad).is_err());
        let mut bad = ok.clone();
        bad.messages[0].role = "system".into();
        assert!(check_request(&bad).is_err());
        let mut bad = ok.clone();
        bad.messages[0].content[1] = Block::Image {
            source: Source {
                kind: "url".into(),
                media_type: "image/png".into(),
                data: "https://x".into(),
            },
        };
        assert!(check_request(&bad).is_err());
        let mut bad = ok.clone();
        bad.tools[0].name = "bad name".into();
        assert!(check_request(&bad).is_err());
        // the wire body keeps Anthropic's field names and drops RealmNest's own
        let mut with_timeout = ok.clone();
        with_timeout.timeout_ms = Some(5);
        let wire = serde_json::to_value(&with_timeout).unwrap();
        assert!(wire.get("timeout_ms").is_none());
        assert_eq!(wire["messages"][2]["content"][0]["type"], "tool_result");
        assert_eq!(wire["tools"][0]["input_schema"]["type"], "object");
    }

    #[test]
    fn http_errors_are_mapped() {
        assert_eq!(http_error(401, b"{}").code, "invalid_credentials");
        assert_eq!(http_error(529, b"{}").code, "provider_unavailable");
        assert_eq!(
            http_error(404, br#"{"error":{"message":"model: x"}}"#).code,
            "model_unavailable"
        );
        assert_eq!(finish_reason("max_tokens"), "length");
    }

    /// a server that answers 500 and then trickles its error body forever
    fn trickling_error_server() -> String {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        std::thread::spawn(move || {
            let Ok((mut s, _)) = listener.accept() else {
                return;
            };
            let mut buf = [0u8; 65536];
            let _ = s.read(&mut buf);
            let _ = s.write_all(
                b"HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{",
            );
            for _ in 0..400 {
                std::thread::sleep(Duration::from_millis(25));
                if s.write_all(b" ").and_then(|_| s.flush()).is_err() {
                    break;
                }
            }
        });
        base
    }

    #[tokio::test]
    async fn an_error_body_that_never_ends_still_ends_the_turn() {
        let base = trickling_error_server();
        let client = Client::with_base(&base, false);
        let mut req: MessagesRequest = serde_json::from_str(
            r#"{"model":"claude-sonnet-5-5","messages":[{"role":"user","content":[{"type":"text","text":"hi"}]}]}"#,
        )
        .unwrap();
        req.timeout_ms = Some(1_000);
        let sink = Collect(StdMutex::new(Vec::new()));
        let (_tx, rx) = watch::channel(false);
        let started = std::time::Instant::now();
        client
            .chat(Some("sk-ant-test".into()), req, &sink, rx)
            .await;
        let events = sink.0.into_inner().unwrap();
        assert!(matches!(events.last(), Some(StreamEvent::Error(_))));
        assert!(
            started.elapsed() < Duration::from_secs(5),
            "{:?}",
            started.elapsed()
        );
    }
}
