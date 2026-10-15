//! The only native process API the webview has. Three narrow commands, each
//! granted explicitly in capabilities/default.json; there is no "run this
//! command line" entry point. Validation happens in `process` / `programs`.

use crate::openrouter::{
    self, models::ModelDescriptor, ChatRequest, OpenRouterHost, StreamEvent, Validation,
};
use crate::process::protocol::{ProcessMessage, ProgramLocation, RunRequest};
use crate::process::ProcessHost;
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::State;

/// Start an allowlisted program. Returns the run id; output and the final
/// `end` arrive on `on_event`.
#[tauri::command]
pub async fn process_run(
    host: State<'_, ProcessHost>,
    request: RunRequest,
    on_event: Channel<ProcessMessage>,
) -> Result<String, String> {
    Ok(host.start(request, Arc::new(on_event)))
}

/// Stop a run (and its whole process tree). False if it already ended.
#[tauri::command]
pub fn process_cancel(host: State<'_, ProcessHost>, id: String) -> bool {
    host.cancel(&id)
}

/// Where an allowlisted program would be found (for status messages).
#[tauri::command]
pub async fn process_locate(
    host: State<'_, ProcessHost>,
    program: String,
) -> Result<ProgramLocation, String> {
    Ok(host.locate(&program))
}

/// Store (or replace) a connection secret in the OS credential store.
/// There is deliberately no command that reads one back; only page-owned names
/// (`secrets::check_page_name`). The credential store can be slow: off the main thread.
#[tauri::command]
pub async fn secret_set(name: String, value: String) -> Result<(), String> {
    blocking_job(move || crate::secrets::page_set(&name, &value)).await
}

#[tauri::command]
pub async fn secret_delete(name: String) -> Result<(), String> {
    blocking_job(move || crate::secrets::page_delete(&name)).await
}

/// Whether a secret is stored (for status), without revealing it.
#[tauri::command]
pub async fn secret_exists(name: String) -> Result<bool, String> {
    blocking_job(move || crate::secrets::page_exists(&name)).await
}

/// blocking work (credential store, pipes, files, the shell) off the main and async threads
async fn blocking_job<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|_| "the operation stopped unexpectedly".to_string())?
}

// ── OpenRouter: narrow commands only, the key never leaves Rust ──────────

/// Check a connection's stored API key with OpenRouter (no generation).
#[tauri::command]
pub async fn openrouter_validate(
    host: State<'_, Arc<OpenRouterHost>>,
    connection_id: String,
) -> Result<Validation, String> {
    let key = openrouter::api_key(&connection_id)?;
    Ok(host.client.validate(key).await)
}

/// What a connection's key has spent and may still spend (no generation).
#[tauri::command]
pub async fn openrouter_credits(
    host: State<'_, Arc<OpenRouterHost>>,
    connection_id: String,
) -> Result<crate::openrouter::KeyCredits, String> {
    let key = openrouter::api_key(&connection_id)?;
    host.client.credits(key).await.map_err(|e| e.message)
}

/// The public model catalogue, normalized.
#[tauri::command]
pub async fn openrouter_models(
    host: State<'_, Arc<OpenRouterHost>>,
) -> Result<Vec<ModelDescriptor>, String> {
    host.client.models().await.map_err(|e| e.message)
}

/// Start a streamed chat completion on a connection; events arrive on `on_event`.
#[tauri::command]
pub async fn openrouter_chat(
    host: State<'_, Arc<OpenRouterHost>>,
    connection_id: String,
    request: ChatRequest,
    on_event: Channel<StreamEvent>,
) -> Result<String, String> {
    let key = openrouter::api_key(&connection_id)?;
    Ok(host.start(key, request, Arc::new(on_event)))
}

/// Stop a stream; the HTTP connection is closed.
#[tauri::command]
pub fn openrouter_cancel(host: State<'_, Arc<OpenRouterHost>>, id: String) -> bool {
    host.cancel(&id)
}

// ── Tools: three narrow file commands; every path is resolved in src/tools ──

/// List a folder inside the workspace (relative path; "." is the workspace).
#[tauri::command]
pub async fn tool_list_directory(
    workspace: String,
    path: String,
) -> Result<crate::tools::Listing, crate::tools::ToolErr> {
    blocking(move || crate::tools::list_directory(&workspace, &path)).await
}

/// Read a UTF-8 text file inside the workspace.
#[tauri::command]
pub async fn tool_read_text(
    workspace: String,
    path: String,
) -> Result<crate::tools::TextFile, crate::tools::ToolErr> {
    blocking(move || crate::tools::read_text(&workspace, &path)).await
}

/// Write (create or replace) a UTF-8 text file inside the workspace.
#[tauri::command]
pub async fn tool_write_text(
    workspace: String,
    path: String,
    content: String,
) -> Result<crate::tools::Written, crate::tools::ToolErr> {
    blocking(move || crate::tools::write_text(&workspace, &path, &content)).await
}

/// file work off the async runtime's threads
async fn blocking<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, crate::tools::ToolErr> + Send + 'static,
) -> Result<T, crate::tools::ToolErr> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .unwrap_or_else(|_| {
            Err(crate::tools::ToolErr {
                code: "TOOL_EXECUTION_FAILED".into(),
                message: "The file tool stopped unexpectedly.".into(),
            })
        })
}

/// Start a configured MCP server (stdio). Rust checks the launch, asks the user
/// natively the first time this configuration runs, and reports everything,
/// including a refusal, on `channel` (ending with one `exit`).
#[tauri::command]
pub async fn mcp_start(
    host: tauri::State<'_, Arc<crate::mcp::McpHost>>,
    launch: crate::mcp::Launch,
    channel: tauri::ipc::Channel<crate::mcp::McpEvent>,
) -> Result<(), String> {
    let host = host.inner().clone();
    let sink: Arc<dyn crate::mcp::McpSink> = Arc::new(channel);
    tauri::async_runtime::spawn_blocking(move || host.start(launch, sink))
        .await
        .map_err(|_| "the MCP host stopped unexpectedly".to_string())
}

/// Write one JSON-RPC message to a running MCP server (queued; a server that stops
/// reading fails the send after a while, never blocks the window).
#[tauri::command]
pub async fn mcp_send(
    host: tauri::State<'_, Arc<crate::mcp::McpHost>>,
    server_id: String,
    message: serde_json::Value,
) -> Result<(), String> {
    let host = host.inner().clone();
    blocking_job(move || host.send(&server_id, &message)).await
}

/// Stop an MCP server: close its input, then kill its process tree.
#[tauri::command]
pub async fn mcp_stop(
    host: tauri::State<'_, Arc<crate::mcp::McpHost>>,
    server_id: String,
) -> Result<(), String> {
    let host = host.inner().clone();
    tauri::async_runtime::spawn_blocking(move || host.stop(&server_id))
        .await
        .map_err(|_| "the MCP host stopped unexpectedly".to_string())
}

/// Open a RealmNest MCP bridge session for one Claude run: returns the MCP config
/// Claude is started with. Messages from Claude arrive on `channel`.
#[tauri::command]
pub fn mcp_bridge_open(
    bridge: tauri::State<'_, Arc<crate::mcp::bridge::BridgeHost>>,
    session_id: String,
    channel: tauri::ipc::Channel<crate::mcp::bridge::BridgeEvent>,
) -> Result<crate::mcp::bridge::OpenedBridge, String> {
    bridge.open(&session_id, Arc::new(channel))
}

/// Answer Claude through the bridge (JSON-RPC responses from the page's MCP server).
#[tauri::command]
pub async fn mcp_bridge_send(
    bridge: tauri::State<'_, Arc<crate::mcp::bridge::BridgeHost>>,
    session_id: String,
    message: serde_json::Value,
) -> Result<(), String> {
    let bridge = bridge.inner().clone();
    blocking_job(move || bridge.send(&session_id, &message)).await
}

/// End a bridge session (the run is over).
#[tauri::command]
pub fn mcp_bridge_close(
    bridge: tauri::State<'_, Arc<crate::mcp::bridge::BridgeHost>>,
    session_id: String,
) {
    bridge.close(&session_id)
}

type Skills<'a> = tauri::State<'a, Arc<crate::skills::SkillStore>>;

/// Replace an installed Skill's package (every file is checked again here).
#[tauri::command]
pub async fn skill_store(
    store: Skills<'_>,
    id: String,
    files: Vec<crate::skills::WireFile>,
) -> Result<(), String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.write(&id, &files))
        .await
        .map_err(|_| "the skill store stopped".to_string())?
}

/// The files of an installed Skill.
#[tauri::command]
pub async fn skill_load(
    store: Skills<'_>,
    id: String,
) -> Result<Vec<crate::skills::WireFile>, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.read(&id))
        .await
        .map_err(|_| "the skill store stopped".to_string())?
}

/// One file of an installed Skill (base64), by logical path.
#[tauri::command]
pub async fn skill_read_file(
    store: Skills<'_>,
    id: String,
    path: String,
) -> Result<String, String> {
    let store = store.inner().clone();
    blocking_job(move || store.read_file(&id, &path)).await
}

/// Delete an installed Skill's files.
#[tauri::command]
pub async fn skill_remove(store: Skills<'_>, id: String) -> Result<(), String> {
    let store = store.inner().clone();
    blocking_job(move || store.remove(&id)).await
}

/// Save an exported `.nestra-skill` in Documents/RealmNest Skills.
#[tauri::command]
pub async fn skill_export(
    store: Skills<'_>,
    filename: String,
    text: String,
) -> Result<String, String> {
    let store = store.inner().clone();
    blocking_job(move || store.export(&filename, &text)).await
}

/// Download a Skill package over HTTPS (size-capped); nothing is kept.
#[tauri::command]
pub async fn skill_fetch(url: String) -> Result<crate::skills::Fetched, String> {
    crate::skills::fetch(&url).await
}

// ── managed files (attachments and artifacts; see files/mod.rs) ──

type Files<'a> = tauri::State<'a, std::sync::Arc<crate::files::FileStore>>;

async fn file_job<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, crate::files::FileErr> + Send + 'static,
) -> Result<T, crate::files::FileErr> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|_| crate::files::ferr("IMPORT_FAILED", "The file store stopped."))?
}

/// Keep the request's raw body (the file's bytes) in RealmNest's file store.
#[tauri::command]
pub async fn files_put(
    store: Files<'_>,
    request: tauri::ipc::Request<'_>,
) -> Result<crate::files::Stored, crate::files::FileErr> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err(crate::files::ferr(
            "INVALID_FILE",
            "Send the file as raw bytes.",
        ));
    };
    let bytes = bytes.clone();
    let store = store.inner().clone();
    file_job(move || store.put(&bytes)).await
}

/// A managed file's bytes (binary response, checked against its hash).
#[tauri::command]
pub async fn files_get(
    store: Files<'_>,
    storage_ref: String,
) -> Result<tauri::ipc::Response, crate::files::FileErr> {
    let store = store.inner().clone();
    file_job(move || store.get(&storage_ref).map(tauri::ipc::Response::new)).await
}

#[tauri::command]
pub fn files_exists(store: Files<'_>, storage_ref: String) -> bool {
    store.exists(&storage_ref)
}

#[tauri::command]
pub async fn files_delete(
    store: Files<'_>,
    storage_ref: String,
) -> Result<bool, crate::files::FileErr> {
    let store = store.inner().clone();
    file_job(move || store.delete(&storage_ref)).await
}

/// Move managed files no record uses any more to the trash (older than a day: a file being attached
/// now is kept); trash older than files::TRASH_DAYS is deleted.
#[tauri::command]
pub async fn files_collect(
    store: Files<'_>,
    keep: Vec<String>,
) -> Result<crate::files::Usage, crate::files::FileErr> {
    let store = store.inner().clone();
    file_job(move || {
        Ok(store.collect(
            &keep.into_iter().collect(),
            std::time::Duration::from_secs(24 * 3600),
        ))
    })
    .await
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Imported {
    stored: crate::files::Stored,
    path: String,
}

/// Keep a copy of a file a tool wrote inside a workspace.
#[tauri::command]
pub async fn files_import_workspace(
    store: Files<'_>,
    workspace: String,
    path: String,
) -> Result<Imported, crate::files::FileErr> {
    let store = store.inner().clone();
    file_job(move || {
        store
            .import_workspace(&workspace, &path)
            .map(|(stored, path)| Imported { stored, path })
    })
    .await
}

/// Put a managed file into a workspace, for a tool to open it there.
#[tauri::command]
pub async fn files_to_workspace(
    store: Files<'_>,
    storage_ref: String,
    workspace: String,
    path: String,
) -> Result<crate::tools::Written, crate::files::FileErr> {
    let store = store.inner().clone();
    file_job(move || store.to_workspace(&storage_ref, &workspace, &path)).await
}

/// Export a copy: the system's save dialog where there is one, else Documents/RealmNest Exports.
/// Returns the path written, or None when the user cancelled.
#[tauri::command]
pub async fn files_export(
    window: tauri::WebviewWindow,
    store: Files<'_>,
    storage_ref: String,
    name: String,
) -> Result<Option<String>, crate::files::FileErr> {
    let store = store.inner().clone();
    // the dialog is modal to the RealmNest window
    #[cfg(windows)]
    let owner = window.hwnd().map(|h| h.0 as isize).unwrap_or(0);
    #[cfg(not(windows))]
    let owner = {
        let _ = &window;
        0isize
    };
    file_job(move || {
        if !store.exists(&storage_ref) {
            return Err(crate::files::ferr(
                "FILE_NOT_FOUND",
                "The managed file is gone.",
            ));
        }
        match crate::files::dialog::save_as(&crate::files::safe_name(&name), owner)? {
            crate::files::dialog::Choice::Path(p) => store
                .copy_to(&storage_ref, &p)
                .map(|_| Some(p.to_string_lossy().into_owned())),
            crate::files::dialog::Choice::Cancelled => Ok(None),
            crate::files::dialog::Choice::NoDialog => store
                .export_default(&storage_ref, &name)
                .map(|p| Some(p.to_string_lossy().into_owned())),
        }
    })
    .await
}

/// Open a named copy with the system's default app: documents and media only, decided in Rust
/// from the name as written and the file's own bytes (`files::may_open`), never the page's type.
#[tauri::command]
pub async fn files_open(
    store: Files<'_>,
    storage_ref: String,
    name: String,
    mime: Option<String>,
) -> Result<(), crate::files::FileErr> {
    // the page's type is only a hint: the bytes decide
    let _ = mime;
    let store = store.inner().clone();
    file_job(move || {
        let p = store.open_copy(&storage_ref, &name)?;
        crate::files::dialog::open(&p)
    })
    .await
}

/// Open a research report (RealmNest's own HTML export) in the user's browser, locked by
/// `files::report_page` (no scripts, forms or connections, whatever the page holds).
#[tauri::command]
pub async fn files_open_report(
    store: Files<'_>,
    name: String,
    html: String,
) -> Result<(), crate::files::FileErr> {
    let store = store.inner().clone();
    file_job(move || {
        let p = store.report_copy(&name, &html)?;
        crate::files::dialog::open(&p)
    })
    .await
}

/// Show a named copy in the file manager.
#[tauri::command]
pub async fn files_reveal(
    store: Files<'_>,
    storage_ref: String,
    name: String,
) -> Result<(), crate::files::FileErr> {
    let store = store.inner().clone();
    file_job(move || {
        let p = store.named_copy(&storage_ref, &name)?;
        crate::files::dialog::reveal(&p)
    })
    .await
}

/// The embedding models OpenRouter lists (public catalogue).
#[tauri::command]
pub async fn openrouter_embedding_models(
    host: State<'_, Arc<OpenRouterHost>>,
) -> Result<Vec<crate::openrouter::embeddings::EmbeddingModel>, String> {
    host.client.embedding_models().await.map_err(|e| e.message)
}

/// Embed texts on a connection (its key is read here, never by the page).
#[tauri::command]
pub async fn openrouter_embed(
    host: State<'_, Arc<OpenRouterHost>>,
    connection_id: String,
    model: String,
    inputs: Vec<String>,
) -> Result<crate::openrouter::embeddings::Embedded, crate::openrouter::OrError> {
    let key = openrouter::api_key(&connection_id).map_err(|m| crate::openrouter::OrError {
        code: "missing_key".into(),
        message: m,
        status: None,
    })?;
    host.client.embed(key, &model, inputs).await
}

// ── web layer (src/web): public pages only, SSRF-safe ─────────

/// Read one public web page (http/https), every safety rule applied (web/mod.rs).
#[tauri::command]
pub async fn web_fetch(
    url: String,
    max_bytes: Option<usize>,
) -> Result<crate::web::Fetched, crate::web::WebError> {
    crate::web::fetch(&url, crate::web::guard::Policy::PUBLIC, max_bytes).await
}

/// Load a page that needs JavaScript in the hidden reader (WebView2) and return its HTML.
#[cfg(windows)]
#[tauri::command]
pub async fn web_render(
    app: tauri::AppHandle,
    renderer: tauri::State<'_, crate::web::render::Renderer>,
    url: String,
) -> Result<crate::web::render::Rendered, crate::web::WebError> {
    renderer.render(&app, &url).await
}

#[cfg(not(windows))]
#[tauri::command]
pub async fn web_render(url: String) -> Result<(), crate::web::WebError> {
    let _ = url;
    Err(crate::web::WebError::new(
        "RENDER_UNAVAILABLE",
        "the page reader is only built for Windows",
    ))
}

/// Open a source link in the user's browser (public http/https only).
#[tauri::command]
pub async fn web_open(url: String) -> Result<(), crate::web::WebError> {
    // the shell can take its time to answer: never on the main thread
    tauri::async_runtime::spawn_blocking(move || crate::web::open_in_browser(&url))
        .await
        .map_err(|_| {
            crate::web::WebError::new("FETCH_NETWORK", "the browser could not be opened")
        })?
}

// ── Claude account sign-in (claude auth login / logout) ──────

/// Start signing in to a Claude account; events: the sign-in page, the code prompt, the end.
#[tauri::command]
pub fn claude_login_start(
    login: tauri::State<'_, crate::programs::claude_login::ClaudeLogin>,
    config_dir: Option<String>,
    on_event: tauri::ipc::Channel<crate::programs::claude_login::LoginEvent>,
) -> Result<String, String> {
    login.start(config_dir, std::sync::Arc::new(on_event))
}

/// The code the browser showed after signing in.
#[tauri::command]
pub fn claude_login_code(
    login: tauri::State<'_, crate::programs::claude_login::ClaudeLogin>,
    id: String,
    code: String,
) -> Result<(), String> {
    login.code(&id, &code)
}

#[tauri::command]
pub fn claude_login_cancel(
    login: tauri::State<'_, crate::programs::claude_login::ClaudeLogin>,
    id: String,
) -> bool {
    login.cancel(&id)
}

/// Sign this Claude config folder out.
#[tauri::command]
pub async fn claude_logout(config_dir: Option<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || crate::programs::claude_login::logout(config_dir))
        .await
        .map_err(|e| e.to_string())?
}

// ── Anthropic API: the same narrow shape as OpenRouter, the key never leaves Rust ──

#[tauri::command]
pub async fn anthropic_validate(
    host: State<'_, Arc<crate::anthropic::AnthropicHost>>,
    connection_id: String,
) -> Result<Validation, String> {
    let key = openrouter::api_key(&connection_id)?;
    Ok(host.client.validate(key).await)
}

/// The models this connection's key can use.
#[tauri::command]
pub async fn anthropic_models(
    host: State<'_, Arc<crate::anthropic::AnthropicHost>>,
    connection_id: String,
) -> Result<Vec<crate::anthropic::AnthropicModel>, String> {
    let key = openrouter::api_key(&connection_id)?;
    host.client.models(key).await.map_err(|e| e.message)
}

/// Start a streamed Messages turn on a connection; events arrive on `on_event`.
#[tauri::command]
pub async fn anthropic_chat(
    host: State<'_, Arc<crate::anthropic::AnthropicHost>>,
    connection_id: String,
    request: crate::anthropic::MessagesRequest,
    on_event: Channel<StreamEvent>,
) -> Result<String, String> {
    let key = openrouter::api_key(&connection_id)?;
    Ok(host.start(key, request, Arc::new(on_event)))
}

#[tauri::command]
pub fn anthropic_cancel(host: State<'_, Arc<crate::anthropic::AnthropicHost>>, id: String) -> bool {
    host.cancel(&id)
}

// ── MCP servers online (Streamable HTTP) and their OAuth sign-in ──

/// Connect an online MCP server; events (started, messages, exit) arrive on `channel`.
#[tauri::command]
pub async fn mcp_http_start(
    host: tauri::State<'_, Arc<crate::mcp::http::HttpHost>>,
    launch: crate::mcp::http::HttpLaunch,
    channel: tauri::ipc::Channel<crate::mcp::McpEvent>,
) -> Result<(), String> {
    // secrets and sign-ins are read from the credential store: off the main thread
    let host = host.inner().clone();
    blocking_job(move || {
        host.start(launch, Arc::new(channel));
        Ok(())
    })
    .await
}

#[tauri::command]
pub fn mcp_http_send(
    host: tauri::State<'_, Arc<crate::mcp::http::HttpHost>>,
    server_id: String,
    message: serde_json::Value,
) -> Result<(), String> {
    host.inner().send(&server_id, message)
}

#[tauri::command]
pub fn mcp_http_stop(host: tauri::State<'_, Arc<crate::mcp::http::HttpHost>>, server_id: String) {
    host.stop(&server_id);
}

/// Sign in to an online MCP server with OAuth (opens the browser; waits for the answer).
#[tauri::command]
pub async fn mcp_oauth_login(server_id: String, url: String) -> Result<(), String> {
    if !crate::mcp::is_server_id(&server_id) {
        return Err("invalid server id".into());
    }
    let u = crate::mcp::http::check_url(&url)?;
    crate::mcp::oauth::login(&server_id, &u, |page| {
        crate::web::open_in_browser(page).map_err(|e| e.message)
    })
    .await
}

#[tauri::command]
pub async fn mcp_oauth_status(server_id: String) -> bool {
    crate::mcp::is_server_id(&server_id)
        && blocking_job(move || Ok(crate::mcp::oauth::stored(&server_id).is_some()))
            .await
            .unwrap_or(false)
}

#[tauri::command]
pub async fn mcp_oauth_logout(server_id: String) {
    if crate::mcp::is_server_id(&server_id) {
        let _ = blocking_job(move || {
            crate::mcp::oauth::sign_out(&server_id);
            Ok(())
        })
        .await;
    }
}

/// A page's preview picture for a research report (raster only, at most 4 MB, every web rule).
#[tauri::command]
pub async fn web_fetch_image(url: String) -> Result<crate::web::Fetched, crate::web::WebError> {
    crate::web::fetch_image(&url, crate::web::guard::Policy::PUBLIC).await
}

/// A research report as PDF: the locked report page printed by WebView2 to the file the user
/// chooses (the save dialog); the path, or None when cancelled.
#[tauri::command]
pub async fn files_report_pdf(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    store: Files<'_>,
    name: String,
    html: String,
) -> Result<Option<String>, crate::files::FileErr> {
    let store = store.inner().clone();
    #[cfg(windows)]
    let owner = window.hwnd().map(|h| h.0 as isize).unwrap_or(0);
    #[cfg(not(windows))]
    let owner = {
        let _ = &window;
        0isize
    };
    let base = name
        .trim_end_matches(".html")
        .trim_end_matches(".pdf")
        .to_string();
    let (page, out) = file_job(move || {
        let page = store.report_copy(&format!("{base}.html"), &html)?;
        let pdf = crate::files::safe_name(&format!("{base}.pdf"));
        let out = match crate::files::dialog::save_as(&pdf, owner)? {
            crate::files::dialog::Choice::Path(p) => Some(p),
            crate::files::dialog::Choice::Cancelled => None,
            crate::files::dialog::Choice::NoDialog => page.parent().map(|d| d.join(&pdf)),
        };
        Ok((page, out))
    })
    .await?;
    let Some(out) = out else { return Ok(None) };
    crate::files::pdf::print_pdf(&app, &page, &out).await?;
    Ok(Some(out.to_string_lossy().into_owned()))
}
