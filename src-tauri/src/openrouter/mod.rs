//! OpenRouter, called from Rust only. The webview never holds the API key:
//! commands take a connection id, this module reads `conn.<id>.apiKey` from
//! the OS credential store and talks to the one allowed origin.
//!
//! Safety:
//! - one fixed base URL (https://openrouter.ai/api/v1), fixed paths, HTTPS only
//! - redirects are never followed, so the Authorization header cannot leak
//! - typed, size-limited requests; size-limited responses and streams
//! - connect, idle and total timeouts; cancellation by run id
//! - errors are normalized and redacted; nothing logs headers or bodies
//!
//! Text chat is the only generation transport so far; image generation would
//! be a separate command and parser next to `chat`.
//!
//! The same client also speaks to other OpenAI-compatible backends through a
//! fixed [`Flavor`] (OpenAI, a local Ollama): each flavor has its own constant
//! base, paths and body tweaks; nothing here ever takes a URL from the page.
//! See `compat.rs` for what only those flavors need.

pub mod compat;
pub mod embeddings;
pub mod models;
pub mod sse;

use models::ModelDescriptor;
use serde::{Deserialize, Serialize};
use sse::{SseItem, SseParser};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::watch;

pub const BASE: &str = "https://openrouter.ai/api/v1";
// room for chat attachments (images and PDFs travel base64-encoded)
const MAX_REQUEST_BYTES: usize = 24_000_000;
const MAX_PARTS: usize = 16;
// RealmNest tools offered to a model, and what a model may ask back
const MAX_TOOLS: usize = 32;
const MAX_TOOL_SCHEMA_BYTES: usize = 16 * 1024;
const MAX_TOOL_CALLS: usize = 16;
const MAX_TOOL_ARGS_BYTES: usize = 256 * 1024 + 4096;
const MAX_MESSAGES: usize = 1_000;
const MAX_ERROR_BODY: usize = 64 * 1024;
const MAX_CATALOG_BYTES: usize = 20 * 1024 * 1024;
const MAX_STREAM_BYTES: usize = 16 * 1024 * 1024;
const MAX_SSE_LINE: usize = 1024 * 1024;
const IDLE_TIMEOUT: Duration = Duration::from_secs(120);
const DEFAULT_TOTAL_TIMEOUT_MS: u64 = 5 * 60_000;
const MAX_TOTAL_TIMEOUT_MS: u64 = 30 * 60_000;

/// Which OpenAI-compatible backend a client talks to. Each one is a constant:
/// base, paths and body rules are chosen here, never by the frontend.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Flavor {
    OpenRouter,
    /// api.openai.com: an API key, HTTPS only
    OpenAi,
    /// a local Ollama on this PC: the exact loopback base, plain HTTP, no key
    Ollama,
}

impl Flavor {
    /// the name used in messages
    pub fn name(self) -> &'static str {
        match self {
            Flavor::OpenRouter => "OpenRouter",
            Flavor::OpenAi => "OpenAI",
            Flavor::Ollama => "Ollama",
        }
    }

    /// the only origin (and prefix) this flavor talks to
    pub fn base(self) -> &'static str {
        match self {
            Flavor::OpenRouter => BASE,
            Flavor::OpenAi => compat::OPENAI_BASE,
            Flavor::Ollama => compat::OLLAMA_BASE,
        }
    }

    /// HTTPS only, except the exact Ollama loopback base
    pub fn https_only(self) -> bool {
        self != Flavor::Ollama
    }

    /// requests carry the connection's API key
    pub fn needs_key(self) -> bool {
        self != Flavor::Ollama
    }

    /// the chat completions path under `base()`
    fn chat_path(self) -> &'static str {
        match self {
            Flavor::Ollama => "/v1/chat/completions",
            _ => "/chat/completions",
        }
    }

    /// the embeddings path under `base()`
    fn embed_path(self) -> &'static str {
        match self {
            Flavor::Ollama => "/v1/embeddings",
            _ => "/embeddings",
        }
    }

    /// run ids of different hosts never look alike
    fn run_prefix(self) -> &'static str {
        match self {
            Flavor::OpenRouter => "or",
            Flavor::OpenAi => "oa",
            Flavor::Ollama => "ol",
        }
    }
}

/// What the frontend may send for a chat turn.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    /// RealmNest tools the model may call (OpenAI-style functions)
    #[serde(default)]
    pub tools: Vec<ToolSpec>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub timeout_ms: Option<u64>,
    /// answer as JSON matching this schema (models whose catalogue lists structured_outputs)
    #[serde(default)]
    pub response_schema: Option<ResponseSchema>,
    /// OpenRouter's web search plugin with at most this many results (paid per search)
    #[serde(default)]
    pub web_search: Option<u32>,
    /// OpenRouter's `reasoning.effort`, one of [`EFFORTS`] (OpenRouter only)
    #[serde(default)]
    pub effort: Option<String>,
}

/// OpenRouter's reasoning effort levels (OPENROUTER_EFFORTS in provider.ts)
pub const EFFORTS: [&str; 5] = ["minimal", "low", "medium", "high", "xhigh"];

/// A JSON schema the answer must match (`response_format: json_schema`, strict).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseSchema {
    pub name: String,
    pub schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    /// null on an assistant message that only calls tools
    pub content: Option<MessageContent>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCallOut>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

/// A tool the model may call. Only these fields reach OpenRouter.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolSpec {
    #[serde(rename = "type")]
    pub kind: String,
    pub function: FunctionSpec,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionSpec {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

/// A call the assistant made earlier in the conversation (sent back with its result).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallOut {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub function: FunctionCall,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String,
}

fn is_tool_name(n: &str) -> bool {
    !n.is_empty()
        && n.len() <= 64
        && n.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

/// Plain text, or parts when a user message carries images / PDFs.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MessageContent {
    Text(String),
    Parts(Vec<Part>),
}

/// The only parts RealmNest sends. Images and PDFs are inline data URLs: the host
/// never fetches a URL on the frontend's behalf.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Part {
    Text { text: String },
    ImageUrl { image_url: ImageUrl },
    File { file: FileData },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageUrl {
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileData {
    pub filename: String,
    pub file_data: String,
}

impl From<&str> for MessageContent {
    fn from(t: &str) -> Self {
        MessageContent::Text(t.to_string())
    }
}

fn is_image_data_url(u: &str) -> bool {
    ["png", "jpeg", "webp", "gif"]
        .iter()
        .any(|t| u.starts_with(&format!("data:image/{t};base64,")))
}

/// Bytes a message adds to the request, or why it cannot be sent.
fn message_size(m: &ChatMessage) -> Result<usize, &'static str> {
    let mut extra = 0;
    if let Some(calls) = &m.tool_calls {
        if m.role != "assistant" || calls.is_empty() || calls.len() > MAX_TOOL_CALLS {
            return Err("Invalid tool calls.");
        }
        for c in calls {
            if c.kind != "function"
                || c.id.is_empty()
                || c.id.len() > 128
                || !is_tool_name(&c.function.name)
            {
                return Err("Invalid tool call.");
            }
            extra += c.function.arguments.len() + c.id.len();
        }
    }
    if m.role == "tool" {
        match &m.tool_call_id {
            Some(id) if !id.is_empty() && id.len() <= 128 => extra += id.len(),
            _ => return Err("A tool result needs the id of its call."),
        }
    } else if m.tool_call_id.is_some() {
        return Err("Only tool results carry a call id.");
    }
    let Some(content) = &m.content else {
        // only an assistant that calls tools may have no text
        return if m.tool_calls.is_some() {
            Ok(extra)
        } else {
            Err("A message needs content.")
        };
    };
    match content {
        MessageContent::Text(t) => Ok(t.len() + extra),
        MessageContent::Parts(parts) => {
            if m.role != "user" || parts.is_empty() || parts.len() > MAX_PARTS {
                return Err("Invalid message parts.");
            }
            let mut size = 0;
            for p in parts {
                size += match p {
                    Part::Text { text } => text.len(),
                    Part::ImageUrl { image_url } if is_image_data_url(&image_url.url) => {
                        image_url.url.len()
                    }
                    Part::File { file }
                        if file.file_data.starts_with("data:application/pdf;base64,")
                            && !file.filename.is_empty()
                            && file.filename.len() <= 255 =>
                    {
                        file.file_data.len() + file.filename.len()
                    }
                    _ => return Err("Only inline images and PDFs can be attached."),
                };
            }
            Ok(size)
        }
    }
}

/// What a chat stream sends back, in order: `start`?, `delta`*, `usage`?, then one of `done` / `error` / `cancelled`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "t", rename_all = "lowercase")]
pub enum StreamEvent {
    Start {
        #[serde(skip_serializing_if = "Option::is_none")]
        model: Option<String>,
    },
    Delta {
        d: String,
    },
    /// one complete tool call (sent before `done`)
    Tool {
        id: String,
        name: String,
        args: String,
    },
    Usage {
        prompt: u64,
        completion: u64,
        #[serde(skip_serializing_if = "Option::is_none")]
        cost: Option<f64>,
    },
    Done {
        #[serde(rename = "finishReason", skip_serializing_if = "Option::is_none")]
        finish_reason: Option<String>,
    },
    Error(OrError),
    Cancelled,
    /// results of the backend's own web search (structured, never written by the model)
    Search {
        #[serde(skip_serializing_if = "Option::is_none")]
        query: Option<String>,
        results: Vec<SearchHit>,
    },
}

/// One web search result as the backend returned it.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct SearchHit {
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub snippet: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub published: Option<String>,
}

/// a hit from loose JSON fields: http(s) URLs only, short texts
pub fn search_hit(
    url: Option<&str>,
    title: Option<&str>,
    snippet: Option<&str>,
    published: Option<&str>,
) -> Option<SearchHit> {
    let url = url?.trim();
    let lower = url.to_ascii_lowercase();
    if url.len() > 2000 || !(lower.starts_with("https://") || lower.starts_with("http://")) {
        return None;
    }
    let short = |s: Option<&str>, n: usize| {
        s.map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.chars().take(n).collect::<String>())
    };
    Some(SearchHit {
        url: url.to_string(),
        title: short(title, 300),
        snippet: short(snippet, 600),
        published: short(published, 60),
    })
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OrError {
    /// invalid_credentials · missing_key · payment_required · forbidden · model_unavailable ·
    /// bad_request · timeout · rate_limited · provider_unavailable · network · malformed · too_large · unknown
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<u16>,
}

impl OrError {
    fn new(code: &str, message: impl Into<String>, status: Option<u16>) -> Self {
        OrError {
            code: code.into(),
            message: redact(&message.into()),
            status,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Validation {
    /// connected · missing_key · invalid_credentials · unavailable · error
    pub status: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub free_tier: Option<bool>,
}

/// What the key has spent and may still spend (`GET /key`), in US dollars of credits. Every
/// field is optional: OpenRouter adds fields over time and a free key has no limit.
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KeyCredits {
    pub usage: Option<f64>,
    pub usage_daily: Option<f64>,
    pub usage_weekly: Option<f64>,
    pub usage_monthly: Option<f64>,
    /// the key's own spending cap, when one is set
    pub limit: Option<f64>,
    pub limit_remaining: Option<f64>,
    /// "daily" · "weekly" · "monthly" when the cap resets
    pub limit_reset: Option<String>,
    pub is_free_tier: Option<bool>,
}

pub trait EventSink: Send + Sync + 'static {
    fn send(&self, e: StreamEvent);
}

impl EventSink for tauri::ipc::Channel<StreamEvent> {
    fn send(&self, e: StreamEvent) {
        let _ = tauri::ipc::Channel::send(self, e);
    }
}

/// Mask anything that looks like a credential before text leaves this module.
pub fn redact(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for word in s.split_inclusive(|c: char| c.is_whitespace() || c == '"' || c == '\'') {
        let core = word.trim_end_matches(|c: char| c.is_whitespace() || c == '"' || c == '\'');
        if core.starts_with("sk-or-") || core.starts_with("sk-") && core.len() > 20 {
            out.push_str("[redacted]");
            out.push_str(&word[core.len()..]);
        } else {
            out.push_str(word);
        }
    }
    let lower = out.to_lowercase();
    if let Some(i) = lower.find("bearer ") {
        let rest_start = i + 7;
        let end = out[rest_start..]
            .find(char::is_whitespace)
            .map(|e| rest_start + e)
            .unwrap_or(out.len());
        out.replace_range(rest_start..end, "[redacted]");
    }
    out.chars().take(400).collect()
}

/// The HTTP side: one client, one origin.
pub struct Client {
    http: reqwest::Client,
    base: String,
    flavor: Flavor,
}

impl Client {
    pub fn new() -> Self {
        Self::with_base(BASE, true)
    }

    /// `base` other than BASE is for tests against a local mock server.
    pub fn with_base(base: &str, https_only: bool) -> Self {
        Self::build(Flavor::OpenRouter, base, https_only)
    }

    /// The production client of a flavor: its constant base, nothing else.
    pub fn for_flavor(flavor: Flavor) -> Self {
        Self::build(flavor, flavor.base(), flavor.https_only())
    }

    /// A flavor against a local mock server (tests only).
    #[cfg(test)]
    pub(crate) fn flavor_with_base(flavor: Flavor, base: &str, https_only: bool) -> Self {
        Self::build(flavor, base, https_only)
    }

    fn build(flavor: Flavor, base: &str, https_only: bool) -> Self {
        let mut b = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .https_only(https_only)
            .connect_timeout(Duration::from_secs(15))
            .user_agent("RealmNest");
        if flavor == Flavor::Ollama {
            // loopback only: a system proxy must never see (or reroute) local traffic
            b = b.no_proxy();
        }
        Client {
            http: b.build().expect("HTTP client"),
            base: base.trim_end_matches('/').to_string(),
            flavor,
        }
    }

    pub fn flavor(&self) -> Flavor {
        self.flavor
    }

    /// Cheap check (no generation). OpenRouter: `GET /key`; OpenAI: `GET /models`
    /// with the key; Ollama: `GET /api/version` (no key).
    pub async fn validate(&self, key: Option<String>) -> Validation {
        let name = self.flavor.name();
        let v = |status: &str, message: &str| Validation {
            status: status.into(),
            message: message.into(),
            free_tier: None,
        };
        let req = match self.flavor {
            Flavor::OpenRouter | Flavor::OpenAi => {
                let Some(key) = key else {
                    return v("missing_key", "No API key is stored for this connection.");
                };
                let path = if self.flavor == Flavor::OpenRouter {
                    "/key"
                } else {
                    "/models"
                };
                self.http
                    .get(format!("{}{path}", self.base))
                    .bearer_auth(key)
            }
            Flavor::Ollama => self.http.get(format!("{}/api/version", self.base)),
        };
        let resp = req.timeout(Duration::from_secs(20)).send().await;
        let resp = match resp {
            Ok(r) => r,
            Err(e) => return v("unavailable", &network_message(self.flavor, &e)),
        };
        let status = resp.status().as_u16();
        match status {
            200 => {
                let body = read_limited(resp, MAX_ERROR_BODY).await.unwrap_or_default();
                let j = serde_json::from_slice::<serde_json::Value>(&body).ok();
                match self.flavor {
                    Flavor::OpenRouter => Validation {
                        status: "connected".into(),
                        message: "OpenRouter accepted the API key.".into(),
                        free_tier: j.and_then(|j| j["data"]["is_free_tier"].as_bool()),
                    },
                    Flavor::OpenAi => v("connected", "OpenAI accepted the API key."),
                    Flavor::Ollama => match j.as_ref().and_then(|j| j["version"].as_str()) {
                        Some(ver) if compat::is_version(ver) => {
                            v("connected", &format!("Ollama {ver} is running on this PC."))
                        }
                        _ => v("connected", "Ollama is running on this PC."),
                    },
                }
            }
            401 | 403 => v(
                "invalid_credentials",
                &format!("{name} rejected the API key."),
            ),
            300..=399 => v(
                "error",
                &format!("{name} answered with an unexpected redirect."),
            ),
            429 => v(
                "unavailable",
                &format!("{name} is rate limiting this key; try again shortly."),
            ),
            500..=599 => v(
                "unavailable",
                &format!("{name} is not available right now."),
            ),
            _ => v("error", &format!("{name} answered {status}.")),
        }
    }

    /// The key's spending (`GET /key`): credits used (all time, today, this week, this month) and its
    /// cap. No generation, nothing billed.
    pub async fn credits(&self, key: Option<String>) -> Result<KeyCredits, OrError> {
        let Some(key) = key else {
            return Err(OrError::new(
                "missing_key",
                "No API key is stored for this connection.",
                None,
            ));
        };
        let resp = self
            .http
            .get(format!("{}/key", self.base))
            .bearer_auth(key)
            .timeout(Duration::from_secs(20))
            .send()
            .await
            .map_err(|e| OrError::new("network", network_message(self.flavor, &e), None))?;
        let status = resp.status().as_u16();
        if status != 200 {
            return Err(OrError::new(
                if status == 401 || status == 403 {
                    "invalid_credentials"
                } else {
                    "provider_unavailable"
                },
                format!("OpenRouter answered {status}."),
                Some(status),
            ));
        }
        let body = read_limited(resp, MAX_ERROR_BODY).await.unwrap_or_default();
        let j: serde_json::Value = serde_json::from_slice(&body).map_err(|_| {
            OrError::new("malformed", "OpenRouter's answer was not readable.", None)
        })?;
        let d = &j["data"];
        let num = |k: &str| d[k].as_f64();
        Ok(KeyCredits {
            usage: num("usage"),
            usage_daily: num("usage_daily"),
            usage_weekly: num("usage_weekly"),
            usage_monthly: num("usage_monthly"),
            limit: num("limit"),
            limit_remaining: num("limit_remaining"),
            limit_reset: d["limit_reset"]
                .as_str()
                .map(|s| s.chars().take(20).collect()),
            is_free_tier: d["is_free_tier"].as_bool(),
        })
    }

    /// The public catalogue (`GET /models`); no key is sent.
    pub async fn models(&self) -> Result<Vec<ModelDescriptor>, OrError> {
        let resp = self
            .http
            .get(format!("{}/models", self.base))
            .timeout(Duration::from_secs(30))
            .send()
            .await
            .map_err(|e| OrError::new("network", network_message(self.flavor, &e), None))?;
        let status = resp.status().as_u16();
        if status != 200 {
            return Err(OrError::new(
                "provider_unavailable",
                format!("OpenRouter answered {status} for the model list."),
                Some(status),
            ));
        }
        let body = read_limited(resp, MAX_CATALOG_BYTES)
            .await
            .map_err(|_| OrError::new("too_large", "The model list was too large.", None))?;
        models::normalize(&body).map_err(|m| OrError::new("malformed", m, None))
    }

    /// Stream one chat completion; always ends with exactly one done / error / cancelled.
    pub async fn chat(
        &self,
        key: Option<String>,
        req: ChatRequest,
        sink: &dyn EventSink,
        mut cancel: watch::Receiver<bool>,
    ) {
        let end = self.chat_inner(key, req, sink, &mut cancel).await;
        sink.send(end);
    }

    async fn chat_inner(
        &self,
        key: Option<String>,
        req: ChatRequest,
        sink: &dyn EventSink,
        cancel: &mut watch::Receiver<bool>,
    ) -> StreamEvent {
        let flavor = self.flavor;
        let name = flavor.name();
        if key.is_none() && flavor.needs_key() {
            return StreamEvent::Error(OrError::new(
                "missing_key",
                "No API key is stored for this connection.",
                None,
            ));
        }
        let body = match build_body_for(flavor, &req) {
            Ok(b) => b,
            Err(e) => return StreamEvent::Error(e),
        };
        let total = Duration::from_millis(
            req.timeout_ms
                .unwrap_or(DEFAULT_TOTAL_TIMEOUT_MS)
                .clamp(1_000, MAX_TOTAL_TIMEOUT_MS),
        );
        let deadline = tokio::time::Instant::now() + total;

        let mut post = self
            .http
            .post(format!("{}{}", self.base, flavor.chat_path()));
        if let (true, Some(key)) = (flavor.needs_key(), key) {
            post = post.bearer_auth(key);
        }
        if flavor == Flavor::OpenRouter {
            post = post.header("X-Title", "RealmNest OS");
        }
        let send = post.json(&body).send();
        let resp = tokio::select! {
            r = send => r,
            _ = cancelled(cancel) => return StreamEvent::Cancelled,
            _ = tokio::time::sleep_until(deadline) => return StreamEvent::Error(OrError::new("timeout", format!("{name} did not answer in time."), None)),
        };
        let mut resp = match resp {
            Ok(r) => r,
            Err(e) => {
                return StreamEvent::Error(OrError::new(
                    if e.is_timeout() { "timeout" } else { "network" },
                    network_message(flavor, &e),
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
            return StreamEvent::Error(http_error(flavor, status, &raw));
        }

        let mut parser = SseParser::new(MAX_SSE_LINE);
        let mut received = 0usize;
        let mut started = false;
        let mut finish: Option<String> = None;
        // tool calls arrive in pieces (by index); they are sent whole before `done`
        let mut calls: Vec<PendingCall> = Vec::new();
        // web plugin sources, sent once before `done`
        let mut cited: Vec<SearchHit> = Vec::new();
        loop {
            let chunk = tokio::select! {
                c = tokio::time::timeout(IDLE_TIMEOUT, resp.chunk()) => c,
                _ = cancelled(cancel) => return StreamEvent::Cancelled,
                _ = tokio::time::sleep_until(deadline) => return StreamEvent::Error(OrError::new("timeout", "The reply took too long and was stopped.", None)),
            };
            let bytes = match chunk {
                Err(_) => {
                    return StreamEvent::Error(OrError::new(
                        "timeout",
                        format!("{name} stopped sending data."),
                        None,
                    ))
                }
                Ok(Err(e)) => {
                    return StreamEvent::Error(OrError::new(
                        "network",
                        network_message(flavor, &e),
                        None,
                    ))
                }
                Ok(Ok(None)) => {
                    // closed without [DONE]: fine if the model had finished, otherwise a failure
                    return match finish {
                        Some(f) if f != "error" => {
                            send_tool_calls(sink, &calls);
                            if !cited.is_empty() {
                                sink.send(StreamEvent::Search {
                                    query: None,
                                    results: std::mem::take(&mut cited),
                                });
                            }
                            StreamEvent::Done {
                                finish_reason: Some(f),
                            }
                        }
                        _ => StreamEvent::Error(OrError::new(
                            "malformed",
                            "The reply ended before it was complete.",
                            None,
                        )),
                    };
                }
                Ok(Ok(Some(b))) => b,
            };
            received += bytes.len();
            if received > MAX_STREAM_BYTES {
                return StreamEvent::Error(OrError::new(
                    "too_large",
                    "The reply was too large and was stopped.",
                    None,
                ));
            }
            let items = match parser.push(&bytes) {
                Ok(i) => i,
                Err(_) => {
                    return StreamEvent::Error(OrError::new(
                        "malformed",
                        format!("{name} sent a line RealmNest could not read."),
                        None,
                    ))
                }
            };
            for item in items {
                match item {
                    SseItem::Done => {
                        send_tool_calls(sink, &calls);
                        if !cited.is_empty() {
                            sink.send(StreamEvent::Search {
                                query: None,
                                results: std::mem::take(&mut cited),
                            });
                        }
                        return StreamEvent::Done {
                            finish_reason: finish,
                        };
                    }
                    SseItem::Data(json) => {
                        let Ok(v) = serde_json::from_str::<serde_json::Value>(&json) else {
                            continue; // one unreadable chunk is skipped, like the Claude parser does
                        };
                        if let Some(err) = v.get("error") {
                            let code = err["code"].as_u64().map(|c| c as u16);
                            return StreamEvent::Error(stream_error(
                                flavor,
                                code,
                                err["message"].as_str().unwrap_or(""),
                            ));
                        }
                        if !started {
                            started = true;
                            sink.send(StreamEvent::Start {
                                model: v["model"].as_str().map(String::from),
                            });
                        }
                        let choice = &v["choices"][0];
                        if let Some(parts) = choice["delta"]["tool_calls"].as_array() {
                            let added = if flavor == Flavor::Ollama {
                                compat::add_whole_tool_calls(&mut calls, parts)
                            } else {
                                add_tool_deltas(&mut calls, parts)
                            };
                            if let Err(e) = added {
                                return StreamEvent::Error(e);
                            }
                        }
                        // the web plugin's sources arrive as url_citation annotations
                        for list in [
                            &choice["delta"]["annotations"],
                            &choice["message"]["annotations"],
                        ] {
                            for a in list.as_array().map(|a| a.as_slice()).unwrap_or_default() {
                                let c = &a["url_citation"];
                                if let Some(h) = search_hit(
                                    c["url"].as_str(),
                                    c["title"].as_str(),
                                    c["content"].as_str(),
                                    None,
                                ) {
                                    if !cited.iter().any(|x: &SearchHit| x.url == h.url)
                                        && cited.len() < 30
                                    {
                                        cited.push(h);
                                    }
                                }
                            }
                        }
                        if let Some(text) = choice["delta"]["content"].as_str() {
                            if !text.is_empty() {
                                sink.send(StreamEvent::Delta {
                                    d: text.to_string(),
                                });
                            }
                        }
                        if let Some(f) = choice["finish_reason"].as_str() {
                            finish = Some(f.to_string());
                            if f == "error" {
                                return StreamEvent::Error(OrError::new(
                                    "provider_unavailable",
                                    "The model stopped with an error.",
                                    None,
                                ));
                            }
                        }
                        if let Some(u) = v.get("usage").filter(|u| u.is_object()) {
                            sink.send(StreamEvent::Usage {
                                prompt: u["prompt_tokens"].as_u64().unwrap_or(0),
                                completion: u["completion_tokens"].as_u64().unwrap_or(0),
                                cost: u["cost"].as_f64(),
                            });
                        }
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

async fn cancelled(rx: &mut watch::Receiver<bool>) {
    loop {
        if *rx.borrow() {
            return;
        }
        if rx.changed().await.is_err() {
            // sender gone: never cancelled
            std::future::pending::<()>().await;
        }
    }
}

/// A tool call being assembled from streamed pieces.
#[derive(Debug, Default, Clone, PartialEq)]
pub(crate) struct PendingCall {
    index: u64,
    id: String,
    name: String,
    args: String,
}

/// Add one chunk's `delta.tool_calls` to the calls being assembled.
pub(crate) fn add_tool_deltas(
    calls: &mut Vec<PendingCall>,
    parts: &[serde_json::Value],
) -> Result<(), OrError> {
    for p in parts {
        let index = p["index"].as_u64().unwrap_or(calls.len() as u64);
        let pos = match calls.iter().position(|c| c.index == index) {
            Some(i) => i,
            None => {
                if calls.len() >= MAX_TOOL_CALLS {
                    return Err(OrError::new(
                        "too_large",
                        "The model asked for too many tools at once.",
                        None,
                    ));
                }
                calls.push(PendingCall {
                    index,
                    ..Default::default()
                });
                calls.len() - 1
            }
        };
        let c = &mut calls[pos];
        if let Some(id) = p["id"].as_str() {
            if c.id.is_empty() {
                c.id = id.chars().take(128).collect();
            }
        }
        if let Some(name) = p["function"]["name"].as_str() {
            c.name.push_str(name);
        }
        if let Some(args) = p["function"]["arguments"].as_str() {
            c.args.push_str(args);
        }
        if c.args.len() > MAX_TOOL_ARGS_BYTES || c.name.len() > 64 {
            return Err(OrError::new(
                "too_large",
                "A tool call was too large.",
                None,
            ));
        }
    }
    Ok(())
}

fn send_tool_calls(sink: &dyn EventSink, calls: &[PendingCall]) {
    for (i, c) in calls.iter().enumerate() {
        if c.name.is_empty() {
            continue;
        }
        sink.send(StreamEvent::Tool {
            id: if c.id.is_empty() {
                format!("call_{i}")
            } else {
                c.id.clone()
            },
            name: c.name.clone(),
            args: c.args.clone(),
        });
    }
}

/// The OpenRouter body (tests of OpenRouter's own rules).
#[cfg(test)]
fn build_body(req: &ChatRequest) -> Result<serde_json::Value, OrError> {
    build_body_for(Flavor::OpenRouter, req)
}

fn build_body_for(flavor: Flavor, req: &ChatRequest) -> Result<serde_json::Value, OrError> {
    if !models::is_model_id(&req.model) {
        return Err(OrError::new("bad_request", "Choose a valid model.", None));
    }
    if req.messages.is_empty() || req.messages.len() > MAX_MESSAGES {
        return Err(OrError::new("bad_request", "Invalid conversation.", None));
    }
    let mut size = 0usize;
    for m in &req.messages {
        if !matches!(m.role.as_str(), "system" | "user" | "assistant" | "tool") {
            return Err(OrError::new("bad_request", "Invalid message role.", None));
        }
        size += message_size(m).map_err(|e| OrError::new("bad_request", e, None))?;
    }
    if size > MAX_REQUEST_BYTES {
        return Err(OrError::new(
            "too_large",
            "The conversation is too long to send.",
            None,
        ));
    }
    if req.tools.len() > MAX_TOOLS {
        return Err(OrError::new("bad_request", "Too many tools.", None));
    }
    for t in &req.tools {
        let schema = serde_json::to_string(&t.function.parameters).unwrap_or_default();
        if t.kind != "function"
            || !is_tool_name(&t.function.name)
            || t.function.description.len() > 2048
            || !t.function.parameters.is_object()
            || schema.len() > MAX_TOOL_SCHEMA_BYTES
        {
            return Err(OrError::new(
                "bad_request",
                "Invalid tool definition.",
                None,
            ));
        }
        size += schema.len() + t.function.description.len();
    }
    if size > MAX_REQUEST_BYTES {
        return Err(OrError::new(
            "too_large",
            "The conversation is too long to send.",
            None,
        ));
    }
    if let Some(rs) = &req.response_schema {
        let schema = serde_json::to_string(&rs.schema).unwrap_or_default();
        if !is_tool_name(&rs.name) || !rs.schema.is_object() || schema.len() > MAX_TOOL_SCHEMA_BYTES
        {
            return Err(OrError::new(
                "bad_request",
                "Invalid response schema.",
                None,
            ));
        }
    }
    let mut body =
        serde_json::json!({ "model": req.model, "messages": req.messages, "stream": true });
    if let Some(rs) = &req.response_schema {
        body["response_format"] = serde_json::json!({
            "type": "json_schema",
            "json_schema": { "name": rs.name, "strict": true, "schema": rs.schema }
        });
    }
    if !req.tools.is_empty() {
        body["tools"] = serde_json::json!(req.tools);
        body["tool_choice"] = serde_json::json!("auto");
    }
    if flavor != Flavor::OpenRouter {
        // OpenAI rejects unknown body fields; neither backend has OpenRouter's web plugin
        compat::check_body(flavor, req)?;
        body["stream_options"] = serde_json::json!({ "include_usage": true });
    }
    if let Some(e) = &req.effort {
        // compat::check_body refuses it for the other flavors
        if !EFFORTS.contains(&e.as_str()) {
            return Err(OrError::new(
                "bad_request",
                "Invalid reasoning effort.",
                None,
            ));
        }
        body["reasoning"] = serde_json::json!({ "effort": e });
    }
    if let Some(n) = req.web_search.filter(|_| flavor == Flavor::OpenRouter) {
        body["plugins"] = serde_json::json!([{ "id": "web", "max_results": n.clamp(1, 10) }]);
    }
    if let Some(t) = req.max_tokens {
        let field = if flavor == Flavor::OpenAi {
            "max_completion_tokens"
        } else {
            "max_tokens"
        };
        body[field] = serde_json::json!(t.clamp(1, 200_000));
    }
    if let Some(t) = req.temperature {
        if t.is_finite() {
            body["temperature"] = serde_json::json!(t.clamp(0.0, 2.0));
        }
    }
    Ok(body)
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

fn network_message(flavor: Flavor, e: &reqwest::Error) -> String {
    let name = flavor.name();
    if e.is_timeout() {
        format!("{name} did not answer in time.")
    } else if e.is_connect() && flavor == Flavor::Ollama {
        "Ollama is not running on this PC.".into()
    } else if e.is_connect() {
        format!("Could not reach {name} (network or firewall).")
    } else {
        format!("The connection to {name} failed.")
    }
}

/// HTTP status + error body → a normalized error (message redacted and shortened).
fn http_error(flavor: Flavor, status: u16, body: &[u8]) -> OrError {
    let name = flavor.name();
    let j = serde_json::from_slice::<serde_json::Value>(body).ok();
    // OpenAI: {"error":{"message":…}}; Ollama's native API: {"error":"…"}
    let said = j
        .as_ref()
        .and_then(|j| {
            j["error"]["message"]
                .as_str()
                .or_else(|| j["error"].as_str().filter(|_| flavor == Flavor::Ollama))
                .map(String::from)
        })
        .unwrap_or_default();
    // OpenAI says "out of credits" as a 429 with this code
    let no_quota = flavor == Flavor::OpenAi
        && status == 429
        && j.as_ref().is_some_and(|j| {
            j["error"]["code"].as_str() == Some("insufficient_quota")
                || j["error"]["type"].as_str() == Some("insufficient_quota")
        });
    let (code, fallback) = match status {
        _ if no_quota => (
            "payment_required",
            "This OpenAI account has no credits left (check billing).".to_string(),
        ),
        400 => ("bad_request", format!("{name} refused the request.")),
        401 => (
            "invalid_credentials",
            format!("{name} rejected the API key."),
        ),
        402 => (
            "payment_required",
            format!("This {name} key has no credits left."),
        ),
        403 => (
            "forbidden",
            format!("{name} refused this request (permissions, limits or moderation)."),
        ),
        404 => (
            "model_unavailable",
            format!("This model is not available on {name}."),
        ),
        408 => ("timeout", format!("{name} timed out.")),
        429 => (
            "rate_limited",
            format!("{name} is rate limiting this key; try again shortly."),
        ),
        502 | 503 if flavor == Flavor::OpenRouter => (
            "provider_unavailable",
            "No provider is available for this model right now.".to_string(),
        ),
        502 | 503 => (
            "provider_unavailable",
            format!("{name} is not available right now."),
        ),
        _ => ("unknown", format!("{name} returned an error.")),
    };
    let message = if said.is_empty() || status >= 500 {
        fallback
    } else {
        format!("{fallback} ({said})")
    };
    OrError::new(code, message, Some(status))
}

fn stream_error(flavor: Flavor, code: Option<u16>, message: &str) -> OrError {
    match code {
        Some(c) if c >= 400 => http_error(
            flavor,
            c,
            serde_json::json!({ "error": { "message": message } })
                .to_string()
                .as_bytes(),
        ),
        _ => OrError::new(
            "provider_unavailable",
            "The model failed while answering.",
            None,
        ),
    }
}

// ── runs (cancellation by id) ────────────────────────────────

pub struct OpenRouterHost {
    pub client: Client,
    runs: Mutex<HashMap<String, watch::Sender<bool>>>,
    counter: AtomicU64,
}

impl OpenRouterHost {
    pub fn new(client: Client) -> Arc<Self> {
        Arc::new(OpenRouterHost {
            client,
            runs: Mutex::new(HashMap::new()),
            counter: AtomicU64::new(0),
        })
    }

    /// Start a stream in the background; returns its id at once.
    pub fn start(
        self: &Arc<Self>,
        key: Option<String>,
        req: ChatRequest,
        sink: Arc<dyn EventSink>,
    ) -> String {
        let id = format!(
            "{}{}",
            self.client.flavor.run_prefix(),
            self.counter.fetch_add(1, Ordering::SeqCst) + 1
        );
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

    /// Stop a stream: the HTTP request is dropped, which closes the connection.
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

/// `conn.<id>.apiKey` from the credential store; None if missing.
pub fn api_key(connection_id: &str) -> Result<Option<String>, String> {
    crate::secrets::read(&format!("conn.{connection_id}.apiKey"))
}

#[cfg(test)]
mod tests;
