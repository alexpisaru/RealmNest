pub mod anthropic;
pub mod applog;
mod commands;
mod commands_codex;
mod commands_compat;
mod commands_telegram;
pub mod files;
pub mod mcp;
pub mod notify;
pub mod openrouter;
pub mod process;
pub mod programs;
pub mod secrets;
pub mod skills;
pub mod telegram;
pub mod tools;
pub mod update;
pub mod web;

use process::ProcessHost;
use std::sync::Arc;
use tauri::Manager;

#[cfg(windows)]
type WebRenderer = web::render::Renderer;
#[cfg(not(windows))]
#[derive(Default)]
struct WebRenderer;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // one RealmNest per user session: two would share (and overwrite) the same storage, fire
    // schedules twice and poll Telegram twice. A second start focuses the first one and quits.
    #[cfg(windows)]
    if single_instance::another_is_running() {
        single_instance::focus_existing();
        return;
    }
    let app = tauri::Builder::default()
        // the programs the desktop app may start; nothing else can be run
        .manage(ProcessHost::new(vec![
            Arc::new(programs::claude::Claude),
            Arc::new(programs::codex::Codex),
        ]))
        .manage(openrouter::OpenRouterHost::new(openrouter::Client::new()))
        .manage(anthropic::AnthropicHost::new(anthropic::Client::new()))
        // the OpenAI API and the local Ollama: the OpenRouter host with a fixed flavor each
        .manage(openrouter::compat::OpenAiHost::new())
        .manage(openrouter::compat::OllamaHost::new())
        .manage(WebRenderer::default())
        .manage(programs::claude_login::ClaudeLogin::default())
        .manage(programs::codex_login::CodexLogin::default())
        .manage(mcp::http::HttpHost::new(Arc::new(mcp::KeyringSecrets)))
        // updates: signed releases from GitHub (docs/UPDATES.md); the page reaches it only through update_*
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(update::PendingUpdate::default())
        .invoke_handler(tauri::generate_handler![
            commands::process_run,
            commands::process_cancel,
            commands::process_locate,
            commands::secret_set,
            commands::secret_delete,
            commands::secret_exists,
            commands::openrouter_validate,
            commands::openrouter_models,
            commands::openrouter_chat,
            commands::openrouter_cancel,
            commands::tool_list_directory,
            commands::tool_read_text,
            commands::tool_write_text,
            commands::mcp_start,
            commands::mcp_send,
            commands::mcp_stop,
            commands::mcp_bridge_open,
            commands::mcp_bridge_send,
            commands::mcp_bridge_close,
            commands::skill_store,
            commands::skill_load,
            commands::skill_read_file,
            commands::skill_remove,
            commands::skill_export,
            commands::skill_fetch,
            commands::files_put,
            commands::files_get,
            commands::files_exists,
            commands::files_delete,
            commands::files_import_workspace,
            commands::files_to_workspace,
            commands::files_export,
            commands::files_open,
            commands::files_reveal,
            commands::files_collect,
            commands::openrouter_embedding_models,
            commands::openrouter_embed,
            commands::web_fetch,
            commands::web_render,
            commands::web_open,
            commands::notify_show,
            commands::log_write,
            commands::log_read,
            commands::log_reveal,
            update::update_check,
            update::update_install,
            commands::claude_login_start,
            commands::claude_login_code,
            commands::claude_login_cancel,
            commands::claude_logout,
            commands::anthropic_validate,
            commands::anthropic_models,
            commands::anthropic_chat,
            commands::anthropic_cancel,
            commands::mcp_http_start,
            commands::mcp_http_send,
            commands::mcp_http_stop,
            commands::mcp_oauth_login,
            commands::mcp_oauth_status,
            commands::mcp_oauth_logout,
            commands::files_open_report,
            commands::web_fetch_image,
            commands::files_report_pdf,
            commands::openrouter_credits,
            commands_telegram::telegram_status,
            commands_telegram::telegram_verify,
            commands_telegram::telegram_start,
            commands_telegram::telegram_stop,
            commands_telegram::telegram_pair_begin,
            commands_telegram::telegram_pair_cancel,
            commands_telegram::telegram_remove_user,
            commands_telegram::telegram_disconnect,
            commands_telegram::telegram_send,
            commands_telegram::telegram_edit,
            commands_telegram::telegram_answer,
            commands_telegram::telegram_typing,
            commands_telegram::telegram_send_document,
            commands_telegram::telegram_fetch_file,
            commands_telegram::telegram_send_photo,
            commands_compat::compat_validate,
            commands_compat::compat_models,
            commands_compat::compat_chat,
            commands_compat::compat_cancel,
            commands_compat::compat_embedding_models,
            commands_compat::compat_embed,
            commands_compat::ollama_ensure,
            commands_codex::codex_models,
            commands_codex::codex_login_start,
            commands_codex::codex_login_cancel,
            commands_codex::codex_logout
        ])
        .setup(|app| {
            // launches the user approved live in the app's own data folder, written only here
            let data = app.path().app_local_data_dir().ok();
            // RealmNest's own log (docs/DIAGNOSTICS.md): starts, native crashes and what the page reports
            let log = Arc::new(applog::AppLog::new(data.as_ref().map(|d| d.join("logs"))));
            applog::log_panics(log.clone());
            log.write(
                applog::now_ms(),
                "info",
                "app",
                &format!("RealmNest OS {} started", app.package_info().version),
            );
            app.manage(log);
            // no workspace may be (or hold) RealmNest's own data folders (tools/mod.rs)
            let _ = tools::APP_DIRS.set(
                [data.clone(), app.path().app_data_dir().ok()]
                    .into_iter()
                    .flatten()
                    .collect(),
            );
            // Skill packages: RealmNest's own folder; exports to Documents/RealmNest Skills
            if let Some(dir) = data.clone() {
                let exports = app
                    .path()
                    .document_dir()
                    .ok()
                    .map(|d| d.join("RealmNest Skills"));
                app.manage(Arc::new(skills::SkillStore::new(
                    dir.join("skills"),
                    exports,
                )));
            }
            // attachments and artifacts: content-addressed in RealmNest's own folder; exports to Documents/RealmNest Exports
            if let Some(dir) = data.clone() {
                let exports = app
                    .path()
                    .document_dir()
                    .ok()
                    .map(|d| d.join("RealmNest Exports"));
                app.manage(Arc::new(files::FileStore::new(dir.join("files"), exports)));
            }
            let trust = data.as_ref().map(|d| d.join("mcp-trust.json"));
            // the Claude bridge: configs in RealmNest's own folder, this executable as the relay
            if let (Some(dir), Ok(exe)) = (data.clone(), std::env::current_exe()) {
                let bridge = mcp::bridge::BridgeHost::new(dir, exe);
                let _ = programs::claude::BRIDGE_DIR.set(bridge.dir().clone());
                app.manage(Arc::new(bridge));
            }
            // the Telegram bridge: paired users and the update offset in RealmNest's own folder
            app.manage(telegram::Telegram::new(
                data.as_ref().map(|d| d.join("telegram.json")),
            ));
            app.manage(Arc::new(mcp::McpHost::new(
                mcp::TrustStore::load(trust),
                Arc::new(mcp::DialogConfirm),
                Arc::new(mcp::KeyringSecrets),
            )));
            Ok(())
        })
        // Phase 2: .plugin(tauri_plugin_sql::Builder::default().build())
        .build(tauri::generate_context!())
        .expect("error while building RealmNest");
    // set once the app is on its way out (exit is then never requested again)
    static EXITING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
    app.run(|handle, event| {
        use std::sync::atomic::Ordering;
        match &event {
            // a WM_CLOSE meant for "the main window" must not reach tao's message window (event_target)
            #[cfg(windows)]
            tauri::RunEvent::Ready => {
                if let Some(main) = handle
                    .get_webview_window("main")
                    .and_then(|w| w.hwnd().ok())
                {
                    event_target::guard(event_target::find_on_this_thread(), main.0);
                }
            }
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                EXITING.store(true, Ordering::SeqCst);
            }
            // closing the main window ends RealmNest, even while a hidden reader or PDF window lives
            tauri::RunEvent::WindowEvent {
                label,
                event: tauri::WindowEvent::Destroyed,
                ..
            } if label == "main" && !EXITING.swap(true, Ordering::SeqCst) => {
                handle.exit(0);
            }
            _ => {}
        }
        // no orphans: end every child process when the app quits
        if let tauri::RunEvent::Exit = event {
            if let Some(log) = handle.try_state::<Arc<applog::AppLog>>() {
                log.write(applog::now_ms(), "info", "app", "RealmNest OS closed");
            }
            handle.state::<ProcessHost>().kill_all();
            handle
                .state::<programs::claude_login::ClaudeLogin>()
                .cancel_all();
            handle
                .state::<programs::codex_login::CodexLogin>()
                .cancel_all();
            handle
                .state::<openrouter::compat::OpenAiHost>()
                .host
                .cancel_all();
            handle
                .state::<openrouter::compat::OllamaHost>()
                .host
                .cancel_all();
            // only an `ollama serve` RealmNest started itself
            openrouter::compat::stop_started_serve();
            handle
                .state::<Arc<openrouter::OpenRouterHost>>()
                .cancel_all();
            handle.state::<Arc<anthropic::AnthropicHost>>().cancel_all();
            handle.state::<Arc<mcp::McpHost>>().kill_all();
            handle.state::<Arc<mcp::http::HttpHost>>().stop_all();
            if let Some(b) = handle.try_state::<Arc<mcp::bridge::BridgeHost>>() {
                b.close_all();
            }
        }
    });
}

/// tao's message window ("Tao Thread Event Target") receives everything other threads send to the
/// event loop: window commands, exit, IPC events. It is an unowned top-level window with the visible
/// style (layered, never drawn), so whatever closes "the process's main window" may pick it: .NET's
/// `Process.CloseMainWindow`, `taskkill` without /F, scripts. Its default WM_CLOSE handling destroys
/// it, and from then on nothing reaches the event loop: Esci and every window command fail ("failed to
/// send message to the webview") and RealmNest can only be killed. Here a WM_CLOSE sent to it closes
/// the main window instead, like its X, and the message window stays.
#[cfg(windows)]
mod event_target {
    use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::System::Threading::GetCurrentThreadId;
    use windows_sys::Win32::UI::Shell::{DefSubclassProc, SetWindowSubclass};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumThreadWindows, GetClassNameW, PostMessageW, WM_CLOSE,
    };

    const CLASS: &str = "Tao Thread Event Target";
    const SUBCLASS_ID: usize = 0x5245_4e54;

    struct Search {
        class: &'static str,
        found: HWND,
    }

    unsafe extern "system" fn visit(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let search = &mut *(lparam as *mut Search);
        let mut buf = [0u16; 64];
        let n = GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        if n > 0 && String::from_utf16_lossy(&buf[..n as usize]).eq_ignore_ascii_case(search.class)
        {
            search.found = hwnd;
            return 0;
        }
        1
    }

    fn find(class: &'static str) -> HWND {
        let mut search = Search {
            class,
            found: std::ptr::null_mut(),
        };
        // SAFETY: `search` outlives the synchronous enumeration
        unsafe {
            EnumThreadWindows(
                GetCurrentThreadId(),
                Some(visit),
                &mut search as *mut Search as LPARAM,
            )
        };
        search.found
    }

    /// tao's message window; call on the event loop's (main) thread. Null if there is none.
    pub fn find_on_this_thread() -> HWND {
        find(CLASS)
    }

    unsafe extern "system" fn on_message(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _id: usize,
        main: usize,
    ) -> LRESULT {
        if msg == WM_CLOSE {
            PostMessageW(main as HWND, WM_CLOSE, 0, 0);
            return 0;
        }
        DefSubclassProc(hwnd, msg, wparam, lparam)
    }

    /// From now on a WM_CLOSE to `target` closes `main`. False if `target` could not be guarded.
    pub fn guard(target: HWND, main: *mut core::ffi::c_void) -> bool {
        // SAFETY: a subclass on a window of this thread; `main` is only posted to (a stale handle fails)
        !target.is_null()
            && unsafe { SetWindowSubclass(target, Some(on_message), SUBCLASS_ID, main as usize) }
                != 0
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            CreateWindowExW, DestroyWindow, IsWindow, PeekMessageW, SendMessageW, MSG, PM_REMOVE,
            WS_OVERLAPPED,
        };

        fn window(class: &str) -> HWND {
            let class: Vec<u16> = class.encode_utf16().chain(std::iter::once(0)).collect();
            // SAFETY: a system window class, no parent, no creation data
            let h = unsafe {
                CreateWindowExW(
                    0,
                    class.as_ptr(),
                    std::ptr::null(),
                    WS_OVERLAPPED,
                    0,
                    0,
                    0,
                    0,
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    std::ptr::null(),
                )
            };
            assert!(!h.is_null());
            h
        }

        #[test]
        fn a_close_sent_to_the_event_target_closes_the_main_window_instead() {
            // stand-ins on this thread: "Static" handles WM_CLOSE like tao's window (DefWindowProc)
            let unguarded = window("Static");
            // SAFETY: windows of this thread; messages handled synchronously
            unsafe {
                SendMessageW(unguarded, WM_CLOSE, 0, 0);
                assert_eq!(
                    IsWindow(unguarded),
                    0,
                    "the default handling destroys the window"
                );
            }
            let target = window("Static");
            let main = window("Button");
            assert_eq!(find("Static"), target);
            assert!(guard(target, main));
            unsafe {
                SendMessageW(target, WM_CLOSE, 0, 0);
                assert_ne!(
                    IsWindow(target),
                    0,
                    "a guarded event target is never destroyed"
                );
                let mut msg: MSG = std::mem::zeroed();
                assert_ne!(
                    PeekMessageW(&mut msg, main, WM_CLOSE, WM_CLOSE, PM_REMOVE),
                    0,
                    "the main window is asked to close"
                );
                DestroyWindow(target);
                DestroyWindow(main);
            }
            assert!(!guard(std::ptr::null_mut(), main));
        }
    }
}

/// One RealmNest per user session (Windows): a named mutex, and the running copy's main window
/// brought to the front by a second start.
#[cfg(windows)]
mod single_instance {
    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, BOOL, ERROR_ALREADY_EXISTS, HWND, LPARAM,
    };
    use windows_sys::Win32::System::Threading::{
        CreateMutexW, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindowVisible,
        SetForegroundWindow, ShowWindow, SW_RESTORE,
    };

    const MUTEX: &str = "Local\\app.nestra.desktop.single";
    /// the main window's title (tauri.conf.json)
    const TITLE: &str = "RealmNest OS";

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// True when another RealmNest holds the mutex. This process keeps its handle open until it
    /// exits (the OS closes it); if the mutex cannot be made at all, RealmNest starts anyway.
    pub fn another_is_running() -> bool {
        let name = wide(MUTEX);
        // SAFETY: a valid NUL-terminated name, no security attributes
        let h = unsafe { CreateMutexW(std::ptr::null(), 0, name.as_ptr()) };
        !h.is_null() && unsafe { GetLastError() } == ERROR_ALREADY_EXISTS
    }

    fn exe_of(pid: u32) -> Option<String> {
        // SAFETY: the handle is checked and closed; the buffer size is passed in
        unsafe {
            let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if h.is_null() {
                return None;
            }
            let mut buf = [0u16; 1024];
            let mut len = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(h, PROCESS_NAME_WIN32, buf.as_mut_ptr(), &mut len);
            CloseHandle(h);
            (ok != 0).then(|| String::from_utf16_lossy(&buf[..len as usize]).to_lowercase())
        }
    }

    struct Search {
        exe: String,
        found: HWND,
    }

    unsafe extern "system" fn visit(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let search = &mut *(lparam as *mut Search);
        // visible windows only: the hidden page reader and PDF printer are never shown
        if IsWindowVisible(hwnd) == 0 {
            return 1;
        }
        let mut buf = [0u16; 128];
        let n = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        if n <= 0 || String::from_utf16_lossy(&buf[..n as usize]) != TITLE {
            return 1;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if exe_of(pid).as_deref() == Some(search.exe.as_str()) {
            search.found = hwnd;
            return 0;
        }
        1
    }

    /// Best effort: restore and raise the running copy's main window (same title, same program).
    pub fn focus_existing() {
        let Some(exe) = std::env::current_exe()
            .ok()
            .and_then(|p| std::fs::canonicalize(&p).ok().or(Some(p)))
            .map(|p| {
                let s = p.to_string_lossy().to_lowercase();
                s.strip_prefix(r"\\?\").map(str::to_string).unwrap_or(s)
            })
        else {
            return;
        };
        let mut search = Search {
            exe,
            found: std::ptr::null_mut(),
        };
        // SAFETY: `search` outlives the synchronous enumeration
        unsafe {
            EnumWindows(Some(visit), &mut search as *mut Search as LPARAM);
            if !search.found.is_null() {
                if IsIconic(search.found) != 0 {
                    ShowWindow(search.found, SW_RESTORE);
                }
                SetForegroundWindow(search.found);
            }
        }
    }
}
