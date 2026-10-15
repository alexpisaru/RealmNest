//! The rendered fallback for pages that need JavaScript: a hidden, short-lived WebView2 window.
//!
//! Used only when the plain HTTP read of a page gives no readable text (an app shell).
//! - hidden (never shown, no taskbar), InPrivate (no cookies or storage kept), its own data
//!   folder (its own browser processes, separate from RealmNest's window);
//! - no Tauri IPC for the page (remote pages get no capability), no downloads, no pop-ups, no
//!   permissions (camera, location, notifications…);
//! - top-level navigations and every sub-request (documents, workers, service workers) are checked:
//!   no localhost, private, link-local or intranet hosts, http(s) (ws(s) to public hosts) only;
//! - every connection goes through RealmNest's guard proxy (proxy.rs, `--proxy-server`, loopback
//!   not bypassed): names are resolved there and refused unless every address is public, so a
//!   public name that resolves to a private address (DNS rebinding) is caught too; WebRTC may not
//!   use UDP outside the proxy (`--force-webrtc-ip-handling-policy=disable_non_proxied_udp`);
//! - one page at a time, 20 s to load, then the page's HTML is read back by a script RealmNest runs
//!   (`ExecuteScript`, results only to Rust) and the window is closed.
//!
//! Nothing it returns is trusted: the page decides its own DOM.

use super::guard::{check_url, Policy};
use super::WebError;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::{oneshot, Mutex};
use webview2_com::Microsoft::Web::WebView2::Win32::*;
use webview2_com::{
    take_pwstr, ExecuteScriptCompletedHandler, NewWindowRequestedEventHandler,
    PermissionRequestedEventHandler, WebResourceRequestedEventHandler,
};
use windows::core::{Interface, HSTRING, PWSTR};

pub const LOAD_TIMEOUT: Duration = Duration::from_secs(20);
/// time for a script-built page to draw itself after "load"
pub const SETTLE: Duration = Duration::from_millis(1500);
pub const MAX_HTML: usize = 3 * 1024 * 1024;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rendered {
    pub final_url: String,
    pub title: String,
    pub html: String,
    #[serde(default)]
    pub elapsed_ms: u64,
}

#[derive(Default)]
pub struct Renderer {
    one_at_a_time: Mutex<()>,
    counter: AtomicU64,
    /// the guard proxy every reader connection goes through (started once)
    proxy: tokio::sync::OnceCell<std::net::SocketAddr>,
}

const READ_PAGE: &str = r#"(() => { const h = document.documentElement ? document.documentElement.outerHTML : ''; return JSON.stringify({ finalUrl: String(location.href), title: String(document.title || ''), html: h.slice(0, 3145728) }); })()"#;

/// is this request allowed to leave the hidden window?
fn request_allowed(uri: &str) -> bool {
    match reqwest::Url::parse(uri) {
        Ok(u) => match u.scheme() {
            "http" | "https" => check_url(&u, &Policy::PUBLIC).is_ok(),
            // WebSockets: the same rules as the page they belong to
            "ws" | "wss" => {
                let mut h = u.clone();
                let scheme = if u.scheme() == "ws" { "http" } else { "https" };
                h.set_scheme(scheme).is_ok() && check_url(&h, &Policy::PUBLIC).is_ok()
            }
            // data: and blob: are created by the page itself; nothing else (file:, custom schemes) goes out
            "data" | "blob" | "about" => true,
            _ => false,
        },
        Err(_) => false,
    }
}

/// The reader's browser: RealmNest's usual switches, every connection through the guard proxy
/// (loopback included: Chromium bypasses proxies for it unless told not to), no UDP around it.
pub fn browser_args(proxy: std::net::SocketAddr) -> String {
    format!(
        "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection \
         --proxy-server=http://{proxy} --proxy-bypass-list=<-loopback> \
         --force-webrtc-ip-handling-policy=disable_non_proxied_udp"
    )
}

impl Renderer {
    pub async fn render(&self, app: &AppHandle, url: &str) -> Result<Rendered, WebError> {
        let started = std::time::Instant::now();
        let parsed = reqwest::Url::parse(url.trim())
            .map_err(|_| WebError::new("FETCH_INVALID_URL", "not a valid web address"))?;
        check_url(&parsed, &Policy::PUBLIC).map_err(|b| WebError::new("FETCH_BLOCKED_URL", b.0))?;
        let _turn = self.one_at_a_time.lock().await;
        // no proxy, no reader: never load a page without the address checks
        let proxy = *self
            .proxy
            .get_or_try_init(|| super::proxy::start(Policy::PUBLIC))
            .await
            .map_err(|e| {
                WebError::new(
                    "RENDER_UNAVAILABLE",
                    format!("the page reader could not start ({e})"),
                )
            })?;
        let label = format!(
            "web-render-{}",
            self.counter.fetch_add(1, Ordering::Relaxed)
        );
        let data_dir = app
            .path()
            .app_local_data_dir()
            .map_err(|e| WebError::new("RENDER_UNAVAILABLE", e.to_string()))?
            .join("web-render");
        let (loaded_tx, loaded_rx) = oneshot::channel::<()>();
        let loaded_tx = std::sync::Mutex::new(Some(loaded_tx));
        // the first top-level navigation refused (a redirect to a private address…), to say why
        let blocked = std::sync::Arc::new(std::sync::Mutex::new(None::<String>));
        let nav_blocked = blocked.clone();
        let window = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(parsed))
            .title("RealmNest web reader")
            .visible(false)
            .skip_taskbar(true)
            .focused(false)
            .incognito(true)
            // its own data folder: its own browser processes, started with these switches
            .data_directory(data_dir)
            .additional_browser_args(&browser_args(proxy))
            .background_throttling(tauri::utils::config::BackgroundThrottlingPolicy::Disabled)
            .on_navigation(move |u| {
                let ok = request_allowed(u.as_str());
                if !ok {
                    if let Ok(mut b) = nav_blocked.lock() {
                        b.get_or_insert_with(|| u.to_string());
                    }
                }
                ok
            })
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
                WebError::new(
                    "RENDER_UNAVAILABLE",
                    format!("the page reader could not start ({e})"),
                )
            })?;

        // sub-requests, pop-ups and permission prompts: checked or refused (on the window's thread)
        let _ = window.with_webview(|wv| unsafe {
            let env = wv.environment();
            let Ok(core) = wv.controller().CoreWebView2() else {
                return;
            };
            let mut token = 0i64;
            // every request source (the page, shared and service workers) where the runtime
            // supports it; the page's own requests otherwise
            let all_sources = core.cast::<ICoreWebView2_22>().is_ok_and(|c22| {
                c22.AddWebResourceRequestedFilterWithRequestSourceKinds(
                    &HSTRING::from("*"),
                    COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
                    COREWEBVIEW2_WEB_RESOURCE_REQUEST_SOURCE_KINDS_ALL,
                )
                .is_ok()
            });
            if !all_sources {
                let _ = core.AddWebResourceRequestedFilter(
                    &HSTRING::from("*"),
                    COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
                );
            }
            let _ = core.add_WebResourceRequested(
                &WebResourceRequestedEventHandler::create(Box::new(move |_, args| {
                    let Some(args) = args else { return Ok(()) };
                    let uri = {
                        let mut p = PWSTR::null();
                        args.Request()?.Uri(&mut p)?;
                        take_pwstr(p)
                    };
                    if !request_allowed(&uri) {
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
            tokio::time::timeout(LOAD_TIMEOUT, loaded_rx)
                .await
                .map_err(|_| {
                    WebError::new("FETCH_TIMEOUT", "the page did not finish loading in time")
                })?
                .map_err(|_| WebError::new("RENDER_UNAVAILABLE", "the page reader closed"))?;
            tokio::time::sleep(SETTLE).await;
            let (tx, rx) = oneshot::channel::<Result<String, String>>();
            let tx = std::sync::Mutex::new(Some(tx));
            window
                .with_webview(move |wv| unsafe {
                    let Ok(core) = wv.controller().CoreWebView2() else {
                        return;
                    };
                    let handler =
                        ExecuteScriptCompletedHandler::create(Box::new(move |res, json| {
                            if let Some(tx) = tx.lock().ok().and_then(|mut t| t.take()) {
                                let _ = tx.send(res.map(|_| json).map_err(|e| e.message()));
                            }
                            Ok(())
                        }));
                    let _ = core.ExecuteScript(&HSTRING::from(READ_PAGE), &handler);
                })
                .map_err(|e| WebError::new("RENDER_UNAVAILABLE", e.to_string()))?;
            let json = tokio::time::timeout(Duration::from_secs(10), rx)
                .await
                .map_err(|_| WebError::new("FETCH_TIMEOUT", "the page could not be read in time"))?
                .map_err(|_| WebError::new("RENDER_UNAVAILABLE", "the page reader closed"))?
                .map_err(|e| {
                    WebError::new(
                        "FETCH_EXTRACTION_FAILED",
                        format!("the page could not be read ({e})"),
                    )
                })?;
            // ExecuteScript returns the script's value as JSON: here a JSON string holding our JSON
            let inner: String = serde_json::from_str(&json).map_err(|_| {
                WebError::new(
                    "FETCH_EXTRACTION_FAILED",
                    "the page returned nothing readable",
                )
            })?;
            let mut r: Rendered = serde_json::from_str(&inner).map_err(|_| {
                WebError::new(
                    "FETCH_EXTRACTION_FAILED",
                    "the page returned nothing readable",
                )
            })?;
            if r.html.len() > MAX_HTML {
                let mut cut = MAX_HTML;
                while !r.html.is_char_boundary(cut) {
                    cut -= 1;
                }
                r.html.truncate(cut);
            }
            r.elapsed_ms = started.elapsed().as_millis() as u64;
            Ok(r)
        }
        .await;
        let _ = window.destroy();
        let r = result?;
        // a refused navigation leaves a blank page: report the block, not an empty read
        if r.final_url.starts_with("about:") {
            if let Some(to) = blocked.lock().ok().and_then(|b| b.clone()) {
                let why = reqwest::Url::parse(&to)
                    .map_err(|_| "not a valid web address".to_string())
                    .and_then(|u| check_url(&u, &Policy::PUBLIC).map_err(|b| b.0))
                    .err()
                    .unwrap_or_else(|| "not a public address".into());
                return Err(WebError::new(
                    "FETCH_BLOCKED_URL",
                    format!("redirect blocked: {why}"),
                ));
            }
        }
        // the page may have navigated itself somewhere else: that address must be public too
        if !request_allowed(&r.final_url) {
            return Err(WebError::new(
                "FETCH_BLOCKED_URL",
                "the page moved to a private or local address",
            ));
        }
        Ok(r)
    }
}

#[cfg(test)]
mod tests {
    use super::request_allowed;

    #[test]
    fn sub_requests_are_checked() {
        assert!(request_allowed("https://example.com/app.js"));
        assert!(request_allowed("data:image/png;base64,AAAA"));
        assert!(!request_allowed("http://127.0.0.1:8080/x"));
        assert!(!request_allowed("http://192.168.1.1/"));
        assert!(!request_allowed("http://localhost/"));
        assert!(!request_allowed("http://169.254.169.254/latest/meta-data"));
        assert!(!request_allowed("file:///C:/Windows/win.ini"));
        assert!(!request_allowed("tauri://localhost/index.html"));
        // WebSockets follow the page rules
        assert!(request_allowed("wss://example.com/socket"));
        assert!(!request_allowed("ws://127.0.0.1:8080/"));
        assert!(!request_allowed("wss://192.168.1.10/"));
        assert!(!request_allowed("ws://localhost/"));
        assert!(!request_allowed("wss://example.com:9000/"));
    }

    #[test]
    fn the_reader_goes_through_the_guard_proxy() {
        let args = super::browser_args("127.0.0.1:5123".parse().unwrap());
        assert!(args.contains("--proxy-server=http://127.0.0.1:5123"));
        assert!(args.contains("--proxy-bypass-list=<-loopback>"));
        assert!(args.contains("--force-webrtc-ip-handling-policy=disable_non_proxied_udp"));
        // wry's defaults are kept
        assert!(args.contains("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection"));
    }
}
