//! Telegram bridge commands (src/telegram, docs/TELEGRAM.md). The token is set with `secret_set`
//! under `telegram.botToken` (write-only) and is read only in Rust.

use crate::files::{FileStore, Stored};
use crate::telegram::{PairCode, Telegram, TgButton, TgEvent, TgStatus, TOKEN_REF};
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::State;

type Tg<'a> = State<'a, Arc<Telegram>>;

#[tauri::command]
pub fn telegram_status(tg: Tg<'_>) -> TgStatus {
    tg.status()
}

/// Checks the stored token (`getMe`) and answers with the bot's @name.
#[tauri::command]
pub async fn telegram_verify(tg: Tg<'_>) -> Result<String, String> {
    tg.verify().await.map_err(|e| e.0)
}

/// Starts long polling; updates from paired users arrive on `on_event` until `telegram_stop`.
#[tauri::command]
pub fn telegram_start(tg: Tg<'_>, on_event: Channel<TgEvent>) -> Result<(), String> {
    let emit: Arc<dyn Fn(TgEvent) + Send + Sync> = Arc::new(move |e| {
        let _ = on_event.send(e);
    });
    tg.inner().start(emit).map_err(|e| e.0)
}

#[tauri::command]
pub fn telegram_stop(tg: Tg<'_>) {
    tg.stop();
}

#[tauri::command]
pub fn telegram_pair_begin(tg: Tg<'_>) -> PairCode {
    tg.pair_begin()
}

#[tauri::command]
pub fn telegram_pair_cancel(tg: Tg<'_>) {
    tg.pair_cancel();
}

#[tauri::command]
pub fn telegram_remove_user(tg: Tg<'_>, user_id: i64) -> bool {
    tg.remove_user(user_id)
}

/// Stops, forgets the paired users and deletes the token.
#[tauri::command]
pub fn telegram_disconnect(tg: Tg<'_>) -> Result<(), String> {
    tg.reset();
    crate::secrets::delete(TOKEN_REF)
}

#[tauri::command]
pub async fn telegram_send(
    tg: Tg<'_>,
    chat_id: i64,
    text: String,
    buttons: Option<Vec<Vec<TgButton>>>,
    html: Option<bool>,
) -> Result<i64, String> {
    tg.send(chat_id, &text, buttons, html.unwrap_or(false))
        .await
        .map_err(|e| e.0)
}

/// A picture from the file store (the agents' portraits) with an optional caption and buttons.
#[tauri::command]
pub async fn telegram_send_photo(
    tg: Tg<'_>,
    files: State<'_, Arc<FileStore>>,
    chat_id: i64,
    storage_ref: String,
    caption: Option<String>,
    buttons: Option<Vec<Vec<TgButton>>>,
    html: Option<bool>,
) -> Result<i64, String> {
    let store = files.inner().clone();
    let bytes = tauri::async_runtime::spawn_blocking(move || store.get(&storage_ref))
        .await
        .map_err(|_| "The file store stopped.".to_string())?
        .map_err(|e| e.message)?;
    tg.send_photo(
        chat_id,
        bytes,
        caption.as_deref(),
        buttons,
        html.unwrap_or(false),
    )
    .await
    .map_err(|e| e.0)
}

#[tauri::command]
pub async fn telegram_edit(
    tg: Tg<'_>,
    chat_id: i64,
    message_id: i64,
    text: String,
    buttons: Option<Vec<Vec<TgButton>>>,
    html: Option<bool>,
) -> Result<(), String> {
    tg.edit(chat_id, message_id, &text, buttons, html.unwrap_or(false))
        .await
        .map_err(|e| e.0)
}

#[tauri::command]
pub async fn telegram_answer(
    tg: Tg<'_>,
    callback_id: String,
    text: Option<String>,
) -> Result<(), String> {
    tg.answer(&callback_id, text.as_deref())
        .await
        .map_err(|e| e.0)
}

#[tauri::command]
pub async fn telegram_typing(tg: Tg<'_>, chat_id: i64) -> Result<(), String> {
    tg.typing(chat_id).await.map_err(|e| e.0)
}

/// Sends a managed file (an Artifact or attachment) to a paired chat as a document.
#[tauri::command]
pub async fn telegram_send_document(
    tg: Tg<'_>,
    files: State<'_, Arc<FileStore>>,
    chat_id: i64,
    storage_ref: String,
    name: String,
    caption: Option<String>,
) -> Result<i64, String> {
    let store = files.inner().clone();
    let bytes = tauri::async_runtime::spawn_blocking(move || store.get(&storage_ref))
        .await
        .map_err(|_| "The file store stopped.".to_string())?
        .map_err(|e| e.message)?;
    tg.send_document(chat_id, &name, bytes, caption.as_deref())
        .await
        .map_err(|e| e.0)
}

/// Downloads a file a paired user sent the bot into RealmNest's file store.
#[tauri::command]
pub async fn telegram_fetch_file(
    tg: Tg<'_>,
    files: State<'_, Arc<FileStore>>,
    file_id: String,
) -> Result<Stored, String> {
    let bytes = tg.fetch_file(&file_id).await.map_err(|e| e.0)?;
    let store = files.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.put(&bytes))
        .await
        .map_err(|_| "The file store stopped.".to_string())?
        .map_err(|e| e.message)
}
