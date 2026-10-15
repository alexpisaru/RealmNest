//! What only the other OpenAI-compatible flavors need: OpenAI (api.openai.com,
//! an API key) and a local Ollama (the exact loopback base, no key).
//!
//! - the frontend picks a flavor by a typed enum (`openai` | `ollama`), never a URL
//! - model lists: OpenAI `GET /models` (needs the key); Ollama `GET /api/tags`
//!   plus `POST /api/show` per model for its capabilities (tools, vision, embedding)
//! - `ensure`: start the local Ollama server when it does not answer, from fixed
//!   places only (`%LOCALAPPDATA%\Programs\Ollama\ollama.exe`, or `ollama` on PATH),
//!   argument `serve` only, no window, OLLAMA_HOST left at its default (127.0.0.1)
//!
//! Hosts are separate state types per flavor so run ids never mix.

use super::embeddings::EmbeddingModel;
use super::models::{self, ModelDescriptor, Pricing, ReasoningInfo};
use super::{
    add_tool_deltas, network_message, read_limited, ChatRequest, Client, Flavor, MessageContent,
    OpenRouterHost, OrError, Part, PendingCall,
};
use serde::{Deserialize, Serialize};
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

pub const OPENAI_BASE: &str = "https://api.openai.com/v1";
/// the only Ollama address RealmNest talks to (Ollama's default bind)
pub const OLLAMA_BASE: &str = "http://127.0.0.1:11434";

const MAX_LIST_BYTES: usize = 8 * 1024 * 1024;
const MAX_SHOW_BYTES: usize = 4 * 1024 * 1024;
const MAX_LOCAL_MODELS: usize = 200;
/// `/api/show` is asked for at most this many models (one local request each)
const MAX_SHOW_CALLS: usize = 64;
const ENSURE_WAIT: Duration = Duration::from_secs(20);

/// The flavors the compat commands accept. There is no variant carrying a URL.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CompatFlavor {
    #[serde(rename = "openai")]
    OpenAi,
    Ollama,
}

impl CompatFlavor {
    pub fn flavor(self) -> Flavor {
        match self {
            CompatFlavor::OpenAi => Flavor::OpenAi,
            CompatFlavor::Ollama => Flavor::Ollama,
        }
    }
}

/// a version string as Ollama reports it ("0.12.3")
pub fn is_version(v: &str) -> bool {
    !v.is_empty()
        && v.len() <= 40
        && v.bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'-' | b'+'))
}

/// Body rules of the non-OpenRouter flavors, checked before anything is sent.
pub(crate) fn check_body(flavor: Flavor, req: &ChatRequest) -> Result<(), OrError> {
    if req.web_search.is_some() {
        return Err(OrError::new(
            "bad_request",
            format!("{} has no web search in RealmNest.", flavor.name()),
            None,
        ));
    }
    if req.effort.is_some() {
        return Err(OrError::new(
            "bad_request",
            format!("{} takes no reasoning effort in RealmNest.", flavor.name()),
            None,
        ));
    }
    if flavor == Flavor::Ollama {
        let pdf = req.messages.iter().any(|m| match &m.content {
            Some(MessageContent::Parts(parts)) => {
                parts.iter().any(|p| matches!(p, Part::File { .. }))
            }
            _ => false,
        });
        if pdf {
            return Err(OrError::new(
                "bad_request",
                "Ollama models cannot read PDF attachments.",
                None,
            ));
        }
    }
    Ok(())
}

/// Ollama sends each tool call whole, and older versions number every one of them 0:
/// a new call id at a used index is a new call.
pub(crate) fn add_whole_tool_calls(
    calls: &mut Vec<PendingCall>,
    parts: &[serde_json::Value],
) -> Result<(), OrError> {
    for p in parts {
        let mut p = p.clone();
        if let (Some(i), Some(id)) = (p["index"].as_u64(), p["id"].as_str()) {
            let clash = !id.is_empty()
                && calls
                    .iter()
                    .any(|c| c.index == i && !c.id.is_empty() && c.id != id);
            if clash {
                let next = calls.iter().map(|c| c.index).max().unwrap_or(i) + 1;
                p["index"] = serde_json::json!(next);
            }
        }
        add_tool_deltas(calls, std::slice::from_ref(&p))?;
    }
    Ok(())
}

// ── model lists ───────────────────────────────────────────────

#[derive(Deserialize)]
struct OpenAiList {
    data: Vec<OpenAiModel>,
}
#[derive(Deserialize)]
struct OpenAiModel {
    id: String,
}

/// ids in OpenAI's list that are not chat-completions models (audio, images,
/// moderation, embeddings, legacy completions, Responses-only agents)
fn openai_not_chat(id: &str) -> bool {
    const SKIP: [&str; 15] = [
        "embedding",
        "whisper",
        "tts",
        "dall-e",
        "moderation",
        "davinci",
        "babbage",
        "transcribe",
        "realtime",
        "audio",
        "image",
        "sora",
        "computer-use",
        "codex",
        "deep-research",
    ];
    let id = id.to_ascii_lowercase();
    SKIP.iter().any(|s| id.contains(s))
}

fn openai_ids(body: &[u8]) -> Result<Vec<String>, String> {
    let list: OpenAiList = serde_json::from_slice(body)
        .map_err(|_| "OpenAI sent a model list RealmNest could not read".to_string())?;
    let mut ids: Vec<String> = list
        .data
        .into_iter()
        .map(|m| m.id)
        .filter(|id| models::is_model_id(id))
        .take(2_000)
        .collect();
    ids.sort();
    ids.dedup();
    Ok(ids)
}

/// OpenAI's `GET /models` → chat models. The list says nothing about modalities or
/// parameters, so those stay empty (unknown), never guessed from names.
pub fn normalize_openai(body: &[u8]) -> Result<Vec<ModelDescriptor>, String> {
    Ok(openai_ids(body)?
        .into_iter()
        .filter(|id| !openai_not_chat(id))
        .map(|id| ModelDescriptor {
            label: id.clone(),
            provider_label: "openai".into(),
            context_length: None,
            input_modalities: vec![],
            output_modalities: vec![],
            supported_parameters: vec![],
            pricing: None,
            reasoning: None,
            id,
        })
        .collect())
}

/// OpenAI's `GET /models` → its embedding models.
pub fn openai_embedding_models(body: &[u8]) -> Result<Vec<EmbeddingModel>, String> {
    Ok(openai_ids(body)?
        .into_iter()
        .filter(|id| id.contains("embedding"))
        .map(|id| EmbeddingModel {
            name: id.clone(),
            id,
            context_length: None,
            price_prompt: None,
        })
        .collect())
}

/// One local model from `GET /api/tags`.
#[derive(Debug, Clone, PartialEq)]
pub struct OllamaTag {
    pub name: String,
    pub family: Option<String>,
    pub parameter_size: Option<String>,
}

#[derive(Deserialize)]
struct RawTags {
    models: Vec<RawTag>,
}
#[derive(Deserialize)]
struct RawTag {
    name: Option<String>,
    model: Option<String>,
    details: Option<RawDetails>,
}
#[derive(Deserialize)]
struct RawDetails {
    family: Option<String>,
    parameter_size: Option<String>,
}

fn short_word(s: Option<String>) -> Option<String> {
    s.map(|s| s.trim().chars().take(40).collect::<String>())
        .filter(|s| {
            !s.is_empty()
                && s.chars()
                    .all(|c| c.is_ascii_alphanumeric() || "._-".contains(c))
        })
}

/// `GET /api/tags` → the installed models (unusable names dropped).
pub fn parse_tags(body: &[u8]) -> Result<Vec<OllamaTag>, String> {
    let raw: RawTags = serde_json::from_slice(body)
        .map_err(|_| "Ollama sent a model list RealmNest could not read".to_string())?;
    let mut out: Vec<OllamaTag> = raw
        .models
        .into_iter()
        .filter_map(|t| {
            let name = t.model.filter(|m| !m.is_empty()).or(t.name)?;
            if !models::is_model_id(&name) {
                return None;
            }
            let d = t.details;
            Some(OllamaTag {
                name,
                family: short_word(d.as_ref().and_then(|d| d.family.clone())),
                parameter_size: short_word(d.and_then(|d| d.parameter_size)),
            })
        })
        .take(MAX_LOCAL_MODELS)
        .collect();
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out.dedup_by(|a, b| a.name == b.name);
    Ok(out)
}

/// What `POST /api/show` says about one model.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct OllamaShow {
    /// completion · tools · vision · thinking · embedding … (None: this Ollama does not say)
    pub capabilities: Option<Vec<String>>,
    pub context_length: Option<u64>,
}

pub fn parse_show(body: &[u8]) -> OllamaShow {
    let Ok(j) = serde_json::from_slice::<serde_json::Value>(body) else {
        return OllamaShow::default();
    };
    let capabilities = j["capabilities"].as_array().map(|a| {
        a.iter()
            .filter_map(|c| c.as_str())
            .filter(|c| c.len() <= 32)
            .take(32)
            .map(String::from)
            .collect()
    });
    let context_length = j["model_info"].as_object().and_then(|info| {
        info.iter()
            .find(|(k, _)| k.ends_with(".context_length"))
            .and_then(|(_, v)| v.as_u64())
    });
    OllamaShow {
        capabilities,
        context_length,
    }
}

fn has(show: &OllamaShow, cap: &str) -> Option<bool> {
    show.capabilities
        .as_ref()
        .map(|c| c.iter().any(|x| x == cap))
}

/// a local model as RealmNest describes it; free (local), capabilities only from `/api/show`
pub fn ollama_descriptor(tag: &OllamaTag, show: &OllamaShow) -> ModelDescriptor {
    let known = show.capabilities.is_some();
    let mut input = vec![];
    let mut output = vec![];
    let mut params = vec![];
    if known {
        input.push("text".to_string());
        output.push("text".to_string());
        if has(show, "vision") == Some(true) {
            input.push("image".into());
        }
        // Ollama's OpenAI-compatible endpoint takes response_format (json_schema) for every chat model
        params.push("response_format".to_string());
        if has(show, "tools") == Some(true) {
            params.push("tools".into());
        }
    }
    ModelDescriptor {
        id: tag.name.clone(),
        label: match &tag.parameter_size {
            Some(p) => format!("{} · {p}", tag.name),
            None => tag.name.clone(),
        },
        provider_label: tag.family.clone().unwrap_or_else(|| "ollama".into()),
        context_length: show.context_length,
        input_modalities: input,
        output_modalities: output,
        supported_parameters: params,
        pricing: Some(Pricing {
            prompt: Some("0".into()),
            completion: Some("0".into()),
        }),
        reasoning: (has(show, "thinking") == Some(true)).then(|| ReasoningInfo {
            mandatory: None,
            efforts: vec![],
        }),
    }
}

/// chat models: what can complete (or, when Ollama does not say, anything not named an embedder)
fn is_chat(tag: &OllamaTag, show: &OllamaShow) -> bool {
    has(show, "completion").unwrap_or_else(|| !tag.name.contains("embed"))
}

fn is_embedder(tag: &OllamaTag, show: &OllamaShow) -> bool {
    has(show, "embedding").unwrap_or_else(|| tag.name.contains("embed"))
}

impl Client {
    async fn get_limited(
        &self,
        path: &str,
        key: Option<String>,
        max: usize,
        what: &str,
    ) -> Result<Vec<u8>, OrError> {
        let mut req = self.http.get(format!("{}{path}", self.base));
        if let (true, Some(k)) = (self.flavor.needs_key(), key) {
            req = req.bearer_auth(k);
        }
        let resp = req
            .timeout(Duration::from_secs(30))
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
                format!("{} answered {status} for {what}.", self.flavor.name()),
                Some(status),
            ));
        }
        read_limited(resp, max)
            .await
            .map_err(|_| OrError::new("too_large", "The model list was too large.", None))
    }

    fn missing_key(&self, key: &Option<String>) -> Result<(), OrError> {
        if self.flavor.needs_key() && key.is_none() {
            return Err(OrError::new(
                "missing_key",
                "No API key is stored for this connection.",
                None,
            ));
        }
        Ok(())
    }

    /// Ollama: the installed models with what `/api/show` says about each.
    async fn local_models(&self) -> Result<Vec<(OllamaTag, OllamaShow)>, OrError> {
        let body = self
            .get_limited("/api/tags", None, MAX_LIST_BYTES, "the model list")
            .await?;
        let tags = parse_tags(&body).map_err(|m| OrError::new("malformed", m, None))?;
        let mut out = Vec::with_capacity(tags.len());
        for (i, tag) in tags.into_iter().enumerate() {
            let show = if i < MAX_SHOW_CALLS {
                self.show(&tag.name).await
            } else {
                OllamaShow::default()
            };
            out.push((tag, show));
        }
        Ok(out)
    }

    /// `POST /api/show` for one model; an empty answer when it fails (capabilities unknown).
    async fn show(&self, name: &str) -> OllamaShow {
        let resp = self
            .http
            .post(format!("{}/api/show", self.base))
            .json(&serde_json::json!({ "model": name }))
            .timeout(Duration::from_secs(10))
            .send()
            .await;
        match resp {
            Ok(r) if r.status().as_u16() == 200 => read_limited(r, MAX_SHOW_BYTES)
                .await
                .map(|b| parse_show(&b))
                .unwrap_or_default(),
            _ => OllamaShow::default(),
        }
    }

    /// The chat models of a compat flavor (OpenAI needs the key; Ollama is local).
    pub async fn compat_models(
        &self,
        key: Option<String>,
    ) -> Result<Vec<ModelDescriptor>, OrError> {
        match self.flavor {
            Flavor::OpenAi => {
                self.missing_key(&key)?;
                let body = self
                    .get_limited("/models", key, MAX_LIST_BYTES, "the model list")
                    .await?;
                normalize_openai(&body).map_err(|m| OrError::new("malformed", m, None))
            }
            Flavor::Ollama => Ok(self
                .local_models()
                .await?
                .iter()
                .filter(|(t, s)| is_chat(t, s))
                .map(|(t, s)| ollama_descriptor(t, s))
                .collect()),
            Flavor::OpenRouter => self.models().await,
        }
    }

    /// The embedding models of a compat flavor.
    pub async fn compat_embedding_models(
        &self,
        key: Option<String>,
    ) -> Result<Vec<EmbeddingModel>, OrError> {
        match self.flavor {
            Flavor::OpenAi => {
                self.missing_key(&key)?;
                let body = self
                    .get_limited("/models", key, MAX_LIST_BYTES, "the model list")
                    .await?;
                openai_embedding_models(&body).map_err(|m| OrError::new("malformed", m, None))
            }
            Flavor::Ollama => Ok(self
                .local_models()
                .await?
                .into_iter()
                .filter(|(t, s)| is_embedder(t, s))
                .map(|(t, s)| EmbeddingModel {
                    name: t.name.clone(),
                    id: t.name,
                    context_length: s.context_length,
                    price_prompt: Some("0".into()),
                })
                .collect()),
            Flavor::OpenRouter => self.embedding_models().await,
        }
    }

    /// Ollama: `GET /api/version`.
    pub async fn ollama_version(&self, timeout: Duration) -> VersionProbe {
        let Ok(resp) = self
            .http
            .get(format!("{}/api/version", self.base))
            .timeout(timeout)
            .send()
            .await
        else {
            return VersionProbe::Down;
        };
        if resp.status().as_u16() != 200 {
            return VersionProbe::Answered(None);
        }
        let body = read_limited(resp, 64 * 1024).await.unwrap_or_default();
        VersionProbe::Answered(
            serde_json::from_slice::<serde_json::Value>(&body)
                .ok()
                .and_then(|j| j["version"].as_str().map(String::from))
                .filter(|v| is_version(v)),
        )
    }
}

// ── starting the local Ollama server ──────────────────────────

/// What `GET /api/version` showed.
#[derive(Debug, Clone, PartialEq)]
pub enum VersionProbe {
    /// nothing answers (not running)
    Down,
    /// something answered; the version when it reads like Ollama's
    Answered(Option<String>),
}

/// What `ollama_ensure` found or did.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OllamaEnsure {
    /// running (it already answered) · started (RealmNest started it) · not_installed · failed
    pub status: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
}

impl OllamaEnsure {
    fn new(status: &str, message: impl Into<String>, version: Option<String>) -> Self {
        OllamaEnsure {
            status: status.into(),
            message: message.into(),
            version,
        }
    }
}

const EXE: &str = if cfg!(windows) {
    "ollama.exe"
} else {
    "ollama"
};

/// The Ollama program, from fixed places only: `%LOCALAPPDATA%\Programs\Ollama\ollama.exe`,
/// then `ollama(.exe)` in an absolute PATH folder (relative PATH entries are ignored).
pub fn find_ollama_in(local_app_data: Option<&OsStr>, path: Option<&OsStr>) -> Option<PathBuf> {
    if let Some(lad) = local_app_data.map(Path::new).filter(|p| p.is_absolute()) {
        let p = lad.join("Programs").join("Ollama").join("ollama.exe");
        if p.is_file() {
            return Some(p);
        }
    }
    std::env::split_paths(path?)
        .filter(|d| d.is_absolute())
        .map(|d| d.join(EXE))
        .find(|p| p.is_file())
}

pub fn find_ollama() -> Option<PathBuf> {
    find_ollama_in(
        std::env::var_os("LOCALAPPDATA").as_deref(),
        std::env::var_os("PATH").as_deref(),
    )
}

/// The `ollama serve` RealmNest started (None when Ollama was already running or started by the
/// user): stopped with RealmNest, its model runners too (its own job).
struct Served {
    child: std::process::Child,
    tree: Option<crate::process::tree::Tree>,
}

static SERVED: std::sync::Mutex<Option<Served>> = std::sync::Mutex::new(None);

/// Stop the `ollama serve` RealmNest started, if any (app exit). An Ollama the user runs is
/// never touched.
pub fn stop_started_serve() {
    let served = SERVED.lock().map(|mut s| s.take()).unwrap_or(None);
    if let Some(mut s) = served {
        crate::process::tree::kill(s.tree.as_ref(), &mut s.child);
        let _ = s.child.wait();
    }
}

/// The variables `ollama serve` gets: what Windows and Ollama itself need (its OLLAMA_* settings
/// and GPU choice), none of the user's other variables (tokens, keys). OLLAMA_HOST stays out:
/// RealmNest only talks to the default 127.0.0.1:11434.
pub fn serve_env(vars: impl IntoIterator<Item = (String, String)>) -> Vec<(String, String)> {
    const KEEP: [&str; 14] = [
        "SYSTEMROOT",
        "WINDIR",
        "SYSTEMDRIVE",
        "PATH",
        "USERPROFILE",
        "HOME",
        "LOCALAPPDATA",
        "APPDATA",
        "TEMP",
        "TMP",
        "PROGRAMFILES",
        "PROGRAMDATA",
        "NUMBER_OF_PROCESSORS",
        "PROCESSOR_ARCHITECTURE",
    ];
    vars.into_iter()
        .filter(|(k, _)| {
            let up = k.to_ascii_uppercase();
            (KEEP.contains(&up.as_str())
                || (up.starts_with("OLLAMA_") && up != "OLLAMA_HOST")
                || up.ends_with("_VISIBLE_DEVICES"))
                && !k.contains('=')
        })
        .collect()
}

/// `ollama serve`, no window, default host (127.0.0.1:11434), a minimal environment; kept so
/// RealmNest can stop it at exit (`stop_started_serve`).
fn spawn_serve(exe: &Path) -> std::io::Result<()> {
    use std::process::{Command, Stdio};
    let mut cmd = Command::new(exe);
    cmd.arg("serve")
        .env_clear()
        .envs(serve_env(std::env::vars_os().filter_map(|(k, v)| {
            Some((k.into_string().ok()?, v.into_string().ok()?))
        })))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if let Some(dir) = exe.parent() {
        cmd.current_dir(dir);
    }
    #[cfg(windows)]
    let child = {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
        const CREATE_BREAKAWAY_FROM_JOB: u32 = 0x0100_0000;
        // out of a job RealmNest itself may run in (into its own one below); not every job allows that
        cmd.creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP | CREATE_BREAKAWAY_FROM_JOB);
        match cmd.spawn() {
            Ok(c) => c,
            Err(_) => {
                cmd.creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP);
                cmd.spawn()?
            }
        }
    };
    #[cfg(not(windows))]
    let child = cmd.spawn()?;
    let tree = crate::process::tree::Tree::adopt(&child);
    if let Ok(mut s) = SERVED.lock() {
        // an earlier one that died is replaced; a live one is not started twice (ensure's gate)
        *s = Some(Served { child, tree });
    }
    Ok(())
}

/// Answer when Ollama runs; otherwise start it (from `find`) and wait for it.
pub async fn ensure_with(
    client: &Client,
    find: impl FnOnce() -> Option<PathBuf>,
    wait: Duration,
) -> OllamaEnsure {
    match client.ollama_version(Duration::from_millis(1500)).await {
        VersionProbe::Answered(Some(v)) => {
            return OllamaEnsure::new("running", format!("Ollama {v} is running."), Some(v))
        }
        VersionProbe::Answered(None) => {
            return OllamaEnsure::new(
                "failed",
                "Something that is not Ollama answers on Ollama's port (11434).",
                None,
            )
        }
        VersionProbe::Down => {}
    }
    let Some(exe) = find() else {
        return OllamaEnsure::new(
            "not_installed",
            "Ollama is not installed on this PC (install it from ollama.com).",
            None,
        );
    };
    if spawn_serve(&exe).is_err() {
        return OllamaEnsure::new("failed", "RealmNest could not start Ollama.", None);
    }
    let deadline = tokio::time::Instant::now() + wait;
    loop {
        tokio::time::sleep(Duration::from_millis(400)).await;
        if let VersionProbe::Answered(v) = client.ollama_version(Duration::from_secs(2)).await {
            let message = match &v {
                Some(v) => format!("RealmNest started Ollama {v}."),
                None => "RealmNest started Ollama.".into(),
            };
            return OllamaEnsure::new("started", message, v);
        }
        if tokio::time::Instant::now() >= deadline {
            return OllamaEnsure::new(
                "failed",
                "Ollama was started but did not answer within 20 seconds.",
                None,
            );
        }
    }
}

// ── hosts (one state type per flavor: run ids never mix) ──────

pub struct OpenAiHost {
    pub host: Arc<OpenRouterHost>,
}

impl OpenAiHost {
    pub fn new() -> Self {
        OpenAiHost {
            host: OpenRouterHost::new(Client::for_flavor(Flavor::OpenAi)),
        }
    }
}

impl Default for OpenAiHost {
    fn default() -> Self {
        Self::new()
    }
}

pub struct OllamaHost {
    pub host: Arc<OpenRouterHost>,
    /// one start attempt at a time
    gate: tokio::sync::Mutex<()>,
}

impl OllamaHost {
    pub fn new() -> Self {
        OllamaHost {
            host: OpenRouterHost::new(Client::for_flavor(Flavor::Ollama)),
            gate: tokio::sync::Mutex::new(()),
        }
    }

    /// `ensure_with` the real program locations, one caller at a time.
    pub async fn ensure(&self) -> OllamaEnsure {
        let _one = self.gate.lock().await;
        ensure_with(&self.host.client, find_ollama, ENSURE_WAIT).await
    }
}

impl Default for OllamaHost {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod serve_tests {
    use super::*;

    #[test]
    fn ollama_serve_gets_a_minimal_environment() {
        let vars = [
            "Path",
            "SystemRoot",
            "USERPROFILE",
            "LOCALAPPDATA",
            "APPDATA",
            "TEMP",
            "TMP",
            "OLLAMA_MODELS",
            "ollama_keep_alive",
            "OLLAMA_HOST",
            "CUDA_VISIBLE_DEVICES",
            "ANTHROPIC_API_KEY",
            "OPENAI_API_KEY",
            "GITHUB_TOKEN",
            "NODE_OPTIONS",
            "=C:",
        ]
        .map(|k| (k.to_string(), "v".to_string()));
        let mut kept: Vec<String> = serve_env(vars).into_iter().map(|(k, _)| k).collect();
        kept.sort();
        assert_eq!(
            kept,
            [
                "APPDATA",
                "CUDA_VISIBLE_DEVICES",
                "LOCALAPPDATA",
                "OLLAMA_MODELS",
                "Path",
                "SystemRoot",
                "TEMP",
                "TMP",
                "USERPROFILE",
                "ollama_keep_alive"
            ]
        );
    }

    #[test]
    fn nothing_is_stopped_when_realmnest_started_nothing() {
        // no serve started in tests: a no-op, never an error
        stop_started_serve();
        assert!(SERVED.lock().unwrap().is_none());
    }
}
