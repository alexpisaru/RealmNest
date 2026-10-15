//! ChatGPT through the Codex CLI (src/programs/codex.rs, codex_login.rs): the account's model
//! list and signing in and out. Turns run through the process host (`process_run` with the
//! `codex` program), whose allowlist decides every argument.

use crate::programs::claude_login::LoginEvent;
use crate::programs::codex::{self, CodexModel};
use crate::programs::codex_login::{self, CodexLogin};
use tauri::ipc::Channel;
use tauri::State;

/// The chat models the signed-in account can use, from Codex's own `models_cache.json` in the
/// connection's Codex folder (default: CODEX_HOME or ~/.codex). Nothing else there is read.
#[tauri::command]
pub async fn codex_models(config_dir: Option<String>) -> Result<Vec<CodexModel>, String> {
    tauri::async_runtime::spawn_blocking(move || codex::models_for(config_dir.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}

/// Starts `codex login` (the browser opens); events arrive on `on_event`.
#[tauri::command]
pub fn codex_login_start(
    login: State<'_, CodexLogin>,
    config_dir: Option<String>,
    on_event: Channel<LoginEvent>,
) -> Result<String, String> {
    login.start(config_dir, std::sync::Arc::new(on_event))
}

#[tauri::command]
pub fn codex_login_cancel(login: State<'_, CodexLogin>, id: String) -> bool {
    login.cancel(&id)
}

/// Signs this Codex folder out (`codex logout`).
#[tauri::command]
pub async fn codex_logout(config_dir: Option<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || codex_login::logout(config_dir))
        .await
        .map_err(|e| e.to_string())?
}
