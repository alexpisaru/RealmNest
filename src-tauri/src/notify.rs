//! Windows notifications (toasts) for things that happen while RealmNest is in the background: an
//! approval to give, a task, crew or workflow that ended (docs/NOTIFICATIONS.md). The page decides
//! when; this only shows plain text under RealmNest's own name. The app's id (`identifier`) is the
//! AppUserModelID the installer puts on the Start menu shortcut, so Windows shows RealmNest's name
//! and icon. A click brings the window back and tells the page which notification it was (`tag`).

/// What a notification may carry: short plain text, and a tag the page gave it.
pub const TITLE_MAX: usize = 100;
pub const BODY_MAX: usize = 300;
pub const TAG_MAX: usize = 80;
/// the page hears about a click on one of its notifications
pub const CLICKED_EVENT: &str = "notification-clicked";

fn clean(s: &str, max: usize) -> String {
    let one_line: String = s
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect();
    let mut out: String = one_line.split_whitespace().collect::<Vec<_>>().join(" ");
    if out.chars().count() > max {
        out = out.chars().take(max - 1).collect::<String>() + "…";
    }
    out
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

/// a tag is an id the page made (`crew:<id>`, `tool:<id>`…): letters, digits and `:._-` only
pub fn valid_tag(tag: &str) -> bool {
    !tag.is_empty()
        && tag.len() <= TAG_MAX
        && tag
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b":._-".contains(&b))
}

/// The toast's XML: a title and a body, escaped. Empty title: refused.
pub fn toast_xml(title: &str, body: &str) -> Result<String, String> {
    let title = clean(title, TITLE_MAX);
    if title.is_empty() {
        return Err("a notification needs a title".into());
    }
    let body = clean(body, BODY_MAX);
    let body_xml = if body.is_empty() {
        String::new()
    } else {
        format!("<text>{}</text>", xml_escape(&body))
    };
    Ok(format!(
        "<toast><visual><binding template=\"ToastGeneric\"><text>{}</text>{}</binding></visual></toast>",
        xml_escape(&title),
        body_xml
    ))
}

#[cfg(windows)]
mod toast {
    use std::collections::VecDeque;
    use std::sync::Mutex;
    use tauri::{Emitter, Manager};
    use windows::core::{IInspectable, Ref, HSTRING};
    use windows::Data::Xml::Dom::XmlDocument;
    use windows::Foundation::TypedEventHandler;
    use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
    use windows::UI::Notifications::{ToastNotification, ToastNotificationManager};

    /// the last toasts stay referenced, so their click handler is still there when the user clicks
    static RECENT: Mutex<VecDeque<ToastNotification>> = Mutex::new(VecDeque::new());

    pub fn show(app: &tauri::AppHandle, xml: &str, tag: Option<String>) -> Result<(), String> {
        let err = |e: windows::core::Error| {
            format!("the notification could not be shown: {}", e.message())
        };
        // SAFETY: initializes COM for this (worker) thread; already initialized is fine
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }
        let doc = XmlDocument::new().map_err(err)?;
        doc.LoadXml(&HSTRING::from(xml)).map_err(err)?;
        let toast = ToastNotification::CreateToastNotification(&doc).map_err(err)?;
        let handle = app.clone();
        toast
            .Activated(&TypedEventHandler::new(
                move |_: Ref<ToastNotification>, _: Ref<IInspectable>| {
                    if let Some(w) = handle.get_webview_window("main") {
                        let _ = w.unminimize();
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                    if let Some(tag) = &tag {
                        let _ = handle.emit(super::CLICKED_EVENT, tag.clone());
                    }
                    Ok(())
                },
            ))
            .map_err(err)?;
        let id = HSTRING::from(app.config().identifier.as_str());
        ToastNotificationManager::CreateToastNotifierWithId(&id)
            .and_then(|n| n.Show(&toast))
            .map_err(err)?;
        if let Ok(mut recent) = RECENT.lock() {
            recent.push_back(toast);
            while recent.len() > 20 {
                recent.pop_front();
            }
        }
        Ok(())
    }
}

/// RealmNest is in the background: its main window is minimized, hidden or does not have the focus.
/// Asked here, not in the page: a minimized WebView2 page still reports that it has the focus.
pub fn in_background(app: &tauri::AppHandle) -> bool {
    use tauri::Manager;
    let Some(w) = app.get_webview_window("main") else {
        return true;
    };
    w.is_minimized().unwrap_or(false)
        || !w.is_visible().unwrap_or(true)
        || !w.is_focused().unwrap_or(false)
}

/// Show one notification (Windows only; elsewhere it does nothing). With `background_only`, nothing is
/// shown while the user is looking at RealmNest. Returns whether it was shown.
pub fn show(
    app: &tauri::AppHandle,
    title: &str,
    body: &str,
    tag: Option<String>,
    background_only: bool,
) -> Result<bool, String> {
    let xml = toast_xml(title, body)?;
    if let Some(t) = &tag {
        if !valid_tag(t) {
            return Err("invalid notification tag".into());
        }
    }
    if background_only && !in_background(app) {
        return Ok(false);
    }
    #[cfg(windows)]
    return toast::show(app, &xml, tag).map(|()| true);
    #[cfg(not(windows))]
    {
        let _ = xml;
        Ok(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_is_escaped_one_line_and_short() {
        let xml = toast_xml("Maya <finished> & \"done\"", "line one\nline\ttwo\u{0}").unwrap();
        assert!(xml.contains("<text>Maya &lt;finished&gt; &amp; &quot;done&quot;</text>"));
        assert!(xml.contains("<text>line one line two</text>"));
        let long = toast_xml(&"a".repeat(500), &"b".repeat(1000)).unwrap();
        assert!(long.contains(&format!("{}…", "a".repeat(TITLE_MAX - 1))));
        assert!(long.contains(&format!("{}…", "b".repeat(BODY_MAX - 1))));
        assert!(toast_xml("   ", "body").is_err());
        assert!(!toast_xml("Title", "").unwrap().contains("<text></text>"));
    }

    #[test]
    fn tags_are_plain_ids() {
        assert!(valid_tag("crew:run-1a2b"));
        assert!(valid_tag("tool:call_9.x"));
        assert!(!valid_tag(""));
        assert!(!valid_tag("crew:<script>"));
        assert!(!valid_tag(&"a".repeat(TAG_MAX + 1)));
    }
}
