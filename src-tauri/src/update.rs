//! Updates (docs/UPDATES.md): the official updater plugin reads `latest.json` from the newest GitHub
//! release, and an update is installed only when its signature matches the public key in
//! tauri.conf.json. The page gets two narrow commands, not the plugin's own: check, and install the
//! update that check found (the NSIS installer runs in passive mode, then RealmNest starts again).

use serde::Serialize;
use std::sync::Mutex;
use tauri::ipc::Channel;
use tauri_plugin_updater::{Update, UpdaterExt};

/// the update the last check found, kept for install
#[derive(Default)]
pub struct PendingUpdate(pub Mutex<Option<Update>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    version: String,
    current: String,
    notes: Option<String>,
    date: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgress {
    downloaded: u64,
    total: Option<u64>,
}

fn short(e: impl std::fmt::Display) -> String {
    e.to_string().chars().take(300).collect()
}

/// Ask GitHub for a newer version. None: RealmNest is up to date.
#[tauri::command]
pub async fn update_check(
    app: tauri::AppHandle,
    pending: tauri::State<'_, PendingUpdate>,
) -> Result<Option<UpdateInfo>, String> {
    let update = app.updater().map_err(short)?.check().await.map_err(short)?;
    let info = update.as_ref().map(|u| UpdateInfo {
        version: u.version.clone(),
        current: u.current_version.clone(),
        notes: u.body.clone().map(|b| b.chars().take(4000).collect()),
        date: u.date.map(|d| d.to_string()),
    });
    if let Ok(mut slot) = pending.0.lock() {
        *slot = update;
    }
    Ok(info)
}

/// Download the update the last check found, verify it and run its installer. On Windows the
/// installer closes RealmNest and starts the new version; elsewhere RealmNest restarts itself.
#[tauri::command]
pub async fn update_install(
    app: tauri::AppHandle,
    pending: tauri::State<'_, PendingUpdate>,
    on_progress: Channel<UpdateProgress>,
) -> Result<(), String> {
    let update = pending
        .0
        .lock()
        .ok()
        .and_then(|s| s.clone())
        .ok_or("no update to install: check again")?;
    if let Some(log) = tauri::Manager::try_state::<std::sync::Arc<crate::applog::AppLog>>(&app) {
        log.write(
            crate::applog::now_ms(),
            "info",
            "update",
            &format!(
                "installing {} over {}",
                update.version, update.current_version
            ),
        );
    }
    let mut downloaded: u64 = 0;
    update
        .download_and_install(
            |chunk, total| {
                downloaded += chunk as u64;
                let _ = on_progress.send(UpdateProgress { downloaded, total });
            },
            || {},
        )
        .await
        .map_err(short)?;
    app.restart();
}
