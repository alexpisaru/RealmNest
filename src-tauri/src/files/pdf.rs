//! Research reports as PDF, printed by WebView2 itself (`PrintToPdf`).
//!
//! The page is RealmNest's own report page, already locked by `report_page` (no connections, no
//! script but the contents one). It is loaded in a hidden, short-lived, InPrivate window that may
//! show that one file and nothing else: other navigations, sub-requests (data: aside), downloads,
//! pop-ups and permissions are refused. Then WebView2 prints it to the chosen file (A4, colours on,
//! no browser header or footer) and the window closes.

use super::{ferr, FileErr};
use std::path::Path;

#[cfg(windows)]
pub async fn print_pdf(app: &tauri::AppHandle, page: &Path, out: &Path) -> Result<(), FileErr> {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::Duration;
    use tauri::webview::PageLoadEvent;
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
    use tokio::sync::oneshot;
    use webview2_com::Microsoft::Web::WebView2::Win32::*;
    use webview2_com::{
        take_pwstr, NewWindowRequestedEventHandler, PermissionRequestedEventHandler,
        PrintToPdfCompletedHandler, WebResourceRequestedEventHandler,
    };
    use windows::core::{Interface, HSTRING, PWSTR};

    static N: AtomicU64 = AtomicU64::new(0);
    let url = reqwest::Url::from_file_path(page)
        .map_err(|_| ferr("INVALID_FILE", "The report page cannot be printed."))?;
    let data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|_| ferr("IMPORT_FAILED", "The PDF printer could not start."))?
        .join("report-pdf");
    let (loaded_tx, loaded_rx) = oneshot::channel::<()>();
    let loaded_tx = std::sync::Mutex::new(Some(loaded_tx));
    let only = url.clone();
    let window = WebviewWindowBuilder::new(
        app,
        format!("report-pdf-{}", N.fetch_add(1, Ordering::Relaxed)),
        WebviewUrl::External(url.clone()),
    )
    .title("RealmNest PDF")
    .visible(false)
    .skip_taskbar(true)
    .focused(false)
    .incognito(true)
    .data_directory(data_dir)
    .background_throttling(tauri::utils::config::BackgroundThrottlingPolicy::Disabled)
    // the report page and nothing else (its links open nowhere here)
    .on_navigation(move |u| *u == only)
    .on_download(|_, _| false)
    .on_page_load(move |_, payload| {
        if payload.event() == PageLoadEvent::Finished {
            if let Some(tx) = loaded_tx.lock().ok().and_then(|mut t| t.take()) {
                let _ = tx.send(());
            }
        }
    })
    .build()
    .map_err(|e| {
        ferr(
            "IMPORT_FAILED",
            format!("The PDF printer could not start ({e})."),
        )
    })?;

    let page_url = url.to_string();
    let _ = window.with_webview(move |wv| unsafe {
        let env = wv.environment();
        let Ok(core) = wv.controller().CoreWebView2() else {
            return;
        };
        let mut token = 0i64;
        let _ = core.AddWebResourceRequestedFilter(
            &HSTRING::from("*"),
            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
        );
        let _ = core.add_WebResourceRequested(
            &WebResourceRequestedEventHandler::create(Box::new(move |_, args| {
                let Some(args) = args else { return Ok(()) };
                let uri = {
                    let mut p = PWSTR::null();
                    args.Request()?.Uri(&mut p)?;
                    take_pwstr(p)
                };
                if uri != page_url && !uri.starts_with("data:") {
                    let resp = env.CreateWebResourceResponse(
                        None,
                        403,
                        &HSTRING::from("Blocked by RealmNest"),
                        &HSTRING::new(),
                    )?;
                    args.SetResponse(&resp)?;
                }
                Ok(())
            })),
            &mut token,
        );
        let _ = core.add_NewWindowRequested(
            &NewWindowRequestedEventHandler::create(Box::new(|_, args| {
                if let Some(args) = args {
                    args.SetHandled(true)?;
                }
                Ok(())
            })),
            &mut token,
        );
        let _ = core.add_PermissionRequested(
            &PermissionRequestedEventHandler::create(Box::new(|_, args| {
                if let Some(args) = args {
                    args.SetState(COREWEBVIEW2_PERMISSION_STATE_DENY)?;
                }
                Ok(())
            })),
            &mut token,
        );
    });

    let result = async {
        tokio::time::timeout(Duration::from_secs(20), loaded_rx)
            .await
            .map_err(|_| ferr("IMPORT_FAILED", "The report did not load in time."))?
            .map_err(|_| ferr("IMPORT_FAILED", "The PDF printer closed."))?;
        // pictures and fonts settle
        tokio::time::sleep(Duration::from_millis(400)).await;
        let (tx, rx) = oneshot::channel::<Result<(), String>>();
        let tx = std::sync::Mutex::new(Some(tx));
        let target = HSTRING::from(out.as_os_str());
        window
            .with_webview(move |wv| unsafe {
                let send = move |r: Result<(), String>| {
                    if let Some(tx) = tx.lock().ok().and_then(|mut t| t.take()) {
                        let _ = tx.send(r);
                    }
                };
                let core = match wv
                    .controller()
                    .CoreWebView2()
                    .and_then(|c| c.cast::<ICoreWebView2_7>())
                {
                    Ok(c) => c,
                    Err(e) => return send(Err(e.message())),
                };
                let settings = match wv
                    .environment()
                    .cast::<ICoreWebView2Environment6>()
                    .and_then(|e| e.CreatePrintSettings())
                {
                    Ok(s) => s,
                    Err(e) => return send(Err(e.message())),
                };
                // A4, colours and pictures on, no browser header or footer
                let _ = settings.SetPageWidth(8.27);
                let _ = settings.SetPageHeight(11.69);
                let _ = settings.SetMarginTop(0.55);
                let _ = settings.SetMarginBottom(0.55);
                let _ = settings.SetMarginLeft(0.6);
                let _ = settings.SetMarginRight(0.6);
                let _ = settings.SetShouldPrintBackgrounds(true);
                let _ = settings.SetShouldPrintHeaderAndFooter(false);
                let tx2 = std::sync::Arc::new(std::sync::Mutex::new(Some(send)));
                let tx3 = tx2.clone();
                let handler = PrintToPdfCompletedHandler::create(Box::new(move |res, ok| {
                    let r = match res {
                        Ok(()) if ok => Ok(()),
                        Ok(()) => Err("the page could not be printed".to_string()),
                        Err(e) => Err(e.message()),
                    };
                    if let Some(send) = tx2.lock().ok().and_then(|mut s| s.take()) {
                        send(r);
                    }
                    Ok(())
                }));
                if let Err(e) = core.PrintToPdf(&target, &settings, &handler) {
                    if let Some(send) = tx3.lock().ok().and_then(|mut s| s.take()) {
                        send(Err(e.message()));
                    }
                }
            })
            .map_err(|e| ferr("IMPORT_FAILED", format!("The PDF printer stopped ({e}).")))?;
        tokio::time::timeout(Duration::from_secs(90), rx)
            .await
            .map_err(|_| ferr("IMPORT_FAILED", "The PDF took too long."))?
            .map_err(|_| ferr("IMPORT_FAILED", "The PDF printer closed."))?
            .map_err(|e| {
                ferr(
                    "IMPORT_FAILED",
                    format!("The PDF could not be written ({e})."),
                )
            })
    }
    .await;
    let _ = window.destroy();
    result?;
    match std::fs::metadata(out) {
        Ok(m) if m.len() > 0 => Ok(()),
        _ => Err(ferr("IMPORT_FAILED", "The PDF could not be written.")),
    }
}

#[cfg(not(windows))]
pub async fn print_pdf(_app: &tauri::AppHandle, _page: &Path, _out: &Path) -> Result<(), FileErr> {
    Err(ferr(
        "UNSUPPORTED_FILE_TYPE",
        "PDF export works in the Windows app.",
    ))
}
