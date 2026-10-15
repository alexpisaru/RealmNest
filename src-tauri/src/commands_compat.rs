//! OpenAI and Ollama: the same narrow commands as OpenRouter, for a typed flavor
//! (`openai` | `ollama`), never a URL. The key (OpenAI only) is read here from the
//! credential store and never reaches the page; Ollama is the fixed loopback base.

use crate::openrouter::compat::{CompatFlavor, OllamaEnsure, OllamaHost, OpenAiHost};
use crate::openrouter::embeddings::{Embedded, EmbeddingModel};
use crate::openrouter::{
    self, models::ModelDescriptor, ChatRequest, OpenRouterHost, OrError, StreamEvent, Validation,
};
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::State;

fn host<'a>(
    flavor: CompatFlavor,
    openai: &'a OpenAiHost,
    ollama: &'a OllamaHost,
) -> &'a Arc<OpenRouterHost> {
    match flavor {
        CompatFlavor::OpenAi => &openai.host,
        CompatFlavor::Ollama => &ollama.host,
    }
}

/// The connection's key when the flavor uses one (Ollama never reads the store).
fn key(flavor: CompatFlavor, connection_id: &str) -> Result<Option<String>, String> {
    if flavor.flavor().needs_key() {
        openrouter::api_key(connection_id)
    } else {
        Ok(None)
    }
}

/// Ollama: start the local server when it does not answer (no-op when it runs).
async fn wake(flavor: CompatFlavor, ollama: &OllamaHost) {
    if flavor == CompatFlavor::Ollama {
        let _ = ollama.ensure().await;
    }
}

/// Check a connection (OpenAI: its key with `GET /models`; Ollama: `GET /api/version`).
#[tauri::command]
pub async fn compat_validate(
    openai: State<'_, OpenAiHost>,
    ollama: State<'_, OllamaHost>,
    flavor: CompatFlavor,
    connection_id: String,
) -> Result<Validation, String> {
    let key = key(flavor, &connection_id)?;
    Ok(host(flavor, &openai, &ollama).client.validate(key).await)
}

/// The chat models a connection can use.
#[tauri::command]
pub async fn compat_models(
    openai: State<'_, OpenAiHost>,
    ollama: State<'_, OllamaHost>,
    flavor: CompatFlavor,
    connection_id: String,
) -> Result<Vec<ModelDescriptor>, String> {
    let key = key(flavor, &connection_id)?;
    host(flavor, &openai, &ollama)
        .client
        .compat_models(key)
        .await
        .map_err(|e| e.message)
}

/// Start a streamed chat completion; events arrive on `on_event`.
#[tauri::command]
pub async fn compat_chat(
    openai: State<'_, OpenAiHost>,
    ollama: State<'_, OllamaHost>,
    flavor: CompatFlavor,
    connection_id: String,
    request: ChatRequest,
    on_event: Channel<StreamEvent>,
) -> Result<String, String> {
    let key = key(flavor, &connection_id)?;
    wake(flavor, &ollama).await;
    Ok(host(flavor, &openai, &ollama).start(key, request, Arc::new(on_event)))
}

/// Stop a stream of that flavor; the HTTP connection is closed.
#[tauri::command]
pub fn compat_cancel(
    openai: State<'_, OpenAiHost>,
    ollama: State<'_, OllamaHost>,
    flavor: CompatFlavor,
    id: String,
) -> bool {
    host(flavor, &openai, &ollama).cancel(&id)
}

/// The embedding models a connection offers.
#[tauri::command]
pub async fn compat_embedding_models(
    openai: State<'_, OpenAiHost>,
    ollama: State<'_, OllamaHost>,
    flavor: CompatFlavor,
    connection_id: String,
) -> Result<Vec<EmbeddingModel>, String> {
    let key = key(flavor, &connection_id)?;
    host(flavor, &openai, &ollama)
        .client
        .compat_embedding_models(key)
        .await
        .map_err(|e| e.message)
}

/// Embed texts on a connection.
#[tauri::command]
pub async fn compat_embed(
    openai: State<'_, OpenAiHost>,
    ollama: State<'_, OllamaHost>,
    flavor: CompatFlavor,
    connection_id: String,
    model: String,
    inputs: Vec<String>,
) -> Result<Embedded, OrError> {
    let key = key(flavor, &connection_id).map_err(|m| OrError {
        code: "missing_key".into(),
        message: m,
        status: None,
    })?;
    wake(flavor, &ollama).await;
    host(flavor, &openai, &ollama)
        .client
        .embed(key, &model, inputs)
        .await
}

/// Make sure the local Ollama answers: start `ollama serve` (fixed locations only) when it does not.
#[tauri::command]
pub async fn ollama_ensure(ollama: State<'_, OllamaHost>) -> Result<OllamaEnsure, String> {
    Ok(ollama.ensure().await)
}
