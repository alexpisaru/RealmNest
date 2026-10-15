//! The web layer's network side: one GET of a public URL, safely.
//!
//! - every URL (the first and each redirect target) passes `guard::check_url`;
//! - host names resolve through `guard::GuardResolver` (no private addresses, no rebinding);
//! - no proxy, no cookies, no credentials, no compression (`Accept-Encoding: identity`, so the
//!   size limit counts the real bytes), at most 5 redirects, followed by hand;
//! - time limits (10 s to connect, 20 s in all) and size limits (5 MB, 10 MB for PDF), checked
//!   on Content-Length and again while streaming;
//! - only readable types are downloaded (HTML, text, JSON, XML, PDF); anything else returns its
//!   metadata and no body (no binary ever lands in a workspace).
//!
//! The page decodes and extracts the text (src/runtime/web). The rendered fallback for
//! JavaScript pages is `render.rs` (WebView2, Windows).

pub mod guard;
pub mod proxy;
#[cfg(windows)]
pub mod render;
#[cfg(test)]
mod tests;

use guard::{check_url, GuardResolver, Policy, BLOCKED_MARK};
use reqwest::header::{HeaderMap, ACCEPT, ACCEPT_ENCODING, CONTENT_LENGTH, CONTENT_TYPE, LOCATION};
use reqwest::Url;
use serde::Serialize;
use std::sync::Arc;
use std::time::{Duration, Instant};

pub const MAX_BYTES: usize = 5 * 1024 * 1024;
pub const MAX_PDF_BYTES: usize = 10 * 1024 * 1024;
pub const MAX_REDIRECTS: usize = 5;
/// a page's preview picture (og:image), for research reports
pub const MAX_IMAGE_BYTES: usize = 4 * 1024 * 1024;

/// What a GET may bring back: a readable page, or a raster picture (never SVG: it can hold script).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Want {
    Page,
    Image,
}

fn picture_type(ct: &str) -> bool {
    let t = ct.to_ascii_lowercase();
    [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "image/gif",
        "image/avif",
    ]
    .iter()
    .any(|x| t.starts_with(x))
}

/// the bytes really are one of the allowed pictures (the header alone is not trusted)
pub fn picture_bytes(b: &[u8]) -> bool {
    b.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A])
        || b.starts_with(&[0xFF, 0xD8, 0xFF])
        || b.starts_with(b"GIF87a")
        || b.starts_with(b"GIF89a")
        || (b.len() > 12 && &b[..4] == b"RIFF" && &b[8..12] == b"WEBP")
        || (b.len() > 12 && &b[4..8] == b"ftyp" && (&b[8..12] == b"avif" || &b[8..12] == b"avis"))
}
pub const TIMEOUT: Duration = Duration::from_secs(20);
pub const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
pub const USER_AGENT: &str =
    "Mozilla/5.0 (compatible; RealmNest/0.6; +web_fetch; reads one page for its user)";

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WebError {
    /// FETCH_INVALID_URL · FETCH_BLOCKED_URL · FETCH_TIMEOUT · FETCH_TOO_LARGE ·
    /// FETCH_TOO_MANY_REDIRECTS · FETCH_UNSUPPORTED_CONTENT · FETCH_ACCESS_DENIED ·
    /// FETCH_NOT_FOUND · FETCH_RATE_LIMITED · FETCH_HTTP_ERROR · FETCH_NETWORK
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<u16>,
    /// metadata of a response that was not downloaded (unsupported type)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_length: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub final_url: Option<String>,
}

impl WebError {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        WebError {
            code: code.into(),
            message: message.into(),
            status: None,
            content_type: None,
            content_length: None,
            final_url: None,
        }
    }
    fn status(mut self, s: u16) -> Self {
        self.status = Some(s);
        self
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Fetched {
    pub url: String,
    pub final_url: String,
    pub status: u16,
    /// every hop after the first, in order
    pub redirects: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
    pub bytes: usize,
    /// the body, base64 (the page decodes it with the declared charset)
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_modified: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_language: Option<String>,
    pub elapsed_ms: u64,
}

/// What may be downloaded: readable types, and responses that do not say (sniffed by the page).
fn readable(ct: &str) -> bool {
    let t = ct.to_ascii_lowercase();
    t.is_empty()
        || t.starts_with("text/")
        || t.contains("html")
        || t.contains("json")
        || t.contains("xml")
        || t.starts_with("application/pdf")
        || t.starts_with("application/x-pdf")
        || t.starts_with("application/javascript") // shown as text, never run
}

fn header(h: &HeaderMap, name: &str) -> Option<String> {
    h.get(name)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.chars().take(200).collect())
}

pub fn client(policy: Policy) -> Result<reqwest::Client, WebError> {
    client_with(policy, TIMEOUT)
}

fn client_with(policy: Policy, total: Duration) -> Result<reqwest::Client, WebError> {
    reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .dns_resolver(Arc::new(GuardResolver { policy }))
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(total)
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| WebError::new("FETCH_NETWORK", e.to_string()))
}

/// the error and its sources, one string (reqwest hides the useful part in the sources)
pub(crate) fn error_chain(e: &reqwest::Error) -> String {
    let mut chain = e.to_string();
    let mut src = std::error::Error::source(e);
    while let Some(s) = src {
        chain.push_str(": ");
        chain.push_str(&s.to_string());
        src = s.source();
    }
    chain
}

pub(crate) fn map_send_error(e: &reqwest::Error) -> WebError {
    let chain = error_chain(e);
    if chain.contains(BLOCKED_MARK) {
        let what = chain
            .split(BLOCKED_MARK)
            .nth(1)
            .unwrap_or("")
            .trim_start_matches(':')
            .trim()
            .chars()
            .take(160)
            .collect::<String>();
        return WebError::new(
            "FETCH_BLOCKED_URL",
            format!("blocked: {what} is a private or local address"),
        );
    }
    if e.is_timeout() {
        return WebError::new("FETCH_TIMEOUT", "the site did not answer in time");
    }
    WebError::new(
        "FETCH_NETWORK",
        format!(
            "the site could not be reached ({})",
            chain.chars().take(160).collect::<String>()
        ),
    )
}

/// GET a public URL with every safety rule. `policy` is `Policy::PUBLIC` in the app.
pub async fn fetch(
    url: &str,
    policy: Policy,
    max_bytes: Option<usize>,
) -> Result<Fetched, WebError> {
    fetch_with(url, policy, max_bytes, TIMEOUT).await
}

/// A page's preview picture (PNG, JPEG, WebP, GIF, AVIF; at most 4 MB) with every safety rule.
pub async fn fetch_image(url: &str, policy: Policy) -> Result<Fetched, WebError> {
    fetch_kind(url, policy, None, TIMEOUT, Want::Image).await
}

/// `fetch` with its own total time limit (tests use a short one).
pub async fn fetch_with(
    url: &str,
    policy: Policy,
    max_bytes: Option<usize>,
    total: Duration,
) -> Result<Fetched, WebError> {
    fetch_kind(url, policy, max_bytes, total, Want::Page).await
}

/// The GET itself, for a page or a picture.
pub async fn fetch_kind(
    url: &str,
    policy: Policy,
    max_bytes: Option<usize>,
    total: Duration,
    want: Want,
) -> Result<Fetched, WebError> {
    let started = Instant::now();
    let first = Url::parse(url.trim())
        .map_err(|_| WebError::new("FETCH_INVALID_URL", "not a valid web address"))?;
    check_url(&first, &policy).map_err(|b| WebError::new("FETCH_BLOCKED_URL", b.0))?;
    let http = client_with(policy, total)?;
    let mut current = first.clone();
    let mut redirects = Vec::new();
    let res = loop {
        let res = tokio::time::timeout(
            total,
            http.get(current.clone())
                .header(
                    ACCEPT,
                    if want == Want::Image {
                        "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9"
                    } else {
                        "text/html,application/xhtml+xml,application/json;q=0.9,text/plain;q=0.9,application/pdf;q=0.8,*/*;q=0.5"
                    },
                )
                .header(ACCEPT_ENCODING, "identity")
                .send(),
        )
        .await
        .map_err(|_| WebError::new("FETCH_TIMEOUT", "the site did not answer in time"))?
        .map_err(|e| map_send_error(&e))?;
        let status = res.status();
        if status.is_redirection() {
            let Some(loc) = res.headers().get(LOCATION).and_then(|v| v.to_str().ok()) else {
                break res;
            };
            if redirects.len() >= MAX_REDIRECTS {
                return Err(WebError::new(
                    "FETCH_TOO_MANY_REDIRECTS",
                    format!("more than {MAX_REDIRECTS} redirects"),
                ));
            }
            let next = current.join(loc).map_err(|_| {
                WebError::new(
                    "FETCH_INVALID_URL",
                    "the site redirected to an invalid address",
                )
            })?;
            // every hop is checked again: a public page must not lead to a private one
            check_url(&next, &policy).map_err(|b| {
                WebError::new("FETCH_BLOCKED_URL", format!("redirect blocked: {}", b.0))
            })?;
            redirects.push(next.to_string());
            current = next;
            continue;
        }
        break res;
    };

    let status = res.status().as_u16();
    let final_url = res.url().to_string();
    let content_type = header(res.headers(), CONTENT_TYPE.as_str());
    let content_length = res
        .headers()
        .get(CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok());
    if !(200..300).contains(&status) {
        let (code, msg) = match status {
            401 | 403 | 407 | 451 => ("FETCH_ACCESS_DENIED", "the site refused access (login, paywall or bot protection): RealmNest does not get around it"),
            404 | 410 => ("FETCH_NOT_FOUND", "the page does not exist"),
            429 => ("FETCH_RATE_LIMITED", "the site is limiting requests; try later"),
            _ => ("FETCH_HTTP_ERROR", "the site answered with an error"),
        };
        let mut e = WebError::new(code, format!("{msg} (HTTP {status})")).status(status);
        e.final_url = Some(final_url);
        return Err(e);
    }
    let ct = content_type.clone().unwrap_or_default();
    let accepted = match want {
        Want::Page => readable(&ct),
        Want::Image => picture_type(&ct),
    };
    if !accepted {
        let mut e = WebError::new(
            "FETCH_UNSUPPORTED_CONTENT",
            format!(
                "this address is a file ({}), not a page: RealmNest does not download it",
                if ct.is_empty() {
                    "unknown type"
                } else {
                    ct.as_str()
                }
            ),
        );
        e.content_type = content_type;
        e.content_length = content_length;
        e.final_url = Some(final_url);
        return Err(e);
    }
    let is_pdf = ct.to_ascii_lowercase().contains("pdf");
    let limit = if want == Want::Image {
        MAX_IMAGE_BYTES
    } else {
        max_bytes
            .unwrap_or(if is_pdf { MAX_PDF_BYTES } else { MAX_BYTES })
            .min(MAX_PDF_BYTES)
    };
    let too_large = |n: u64| {
        let mut e = WebError::new(
            "FETCH_TOO_LARGE",
            format!(
                "the response is larger than {} MB ({} bytes)",
                limit / 1024 / 1024,
                n
            ),
        );
        e.content_length = Some(n);
        e
    };
    if let Some(n) = content_length {
        if n as usize > limit {
            return Err(too_large(n));
        }
    }
    let last_modified = header(res.headers(), "last-modified");
    let content_language = header(res.headers(), "content-language");
    let mut res = res;
    let mut body: Vec<u8> = Vec::with_capacity(
        content_length
            .map(|n| n as usize)
            .unwrap_or(64 * 1024)
            .min(limit),
    );
    loop {
        let left = total.saturating_sub(started.elapsed());
        let chunk = tokio::time::timeout(left, res.chunk())
            .await
            .map_err(|_| WebError::new("FETCH_TIMEOUT", "the site was too slow to send the page"))?
            .map_err(|e| map_send_error(&e))?;
        let Some(chunk) = chunk else { break };
        if body.len() + chunk.len() > limit {
            return Err(too_large((body.len() + chunk.len()) as u64));
        }
        body.extend_from_slice(&chunk);
    }
    if want == Want::Image && !picture_bytes(&body) {
        let mut e = WebError::new(
            "FETCH_UNSUPPORTED_CONTENT",
            "not a PNG, JPEG, WebP, GIF or AVIF picture",
        );
        e.content_type = content_type;
        return Err(e);
    }
    Ok(Fetched {
        url: first.to_string(),
        final_url,
        status,
        redirects,
        content_type,
        bytes: body.len(),
        body: crate::skills::b64_encode(&body),
        last_modified,
        content_language,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

/// Open a public http(s) address in the user's own browser (a source link).
pub fn open_in_browser(url: &str) -> Result<(), WebError> {
    let u = Url::parse(url.trim())
        .map_err(|_| WebError::new("FETCH_INVALID_URL", "not a valid web address"))?;
    check_url(&u, &Policy::PUBLIC).map_err(|b| WebError::new("FETCH_BLOCKED_URL", b.0))?;
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::UI::Shell::ShellExecuteW;
        use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        let wide = |s: &str| {
            std::ffi::OsStr::new(s)
                .encode_wide()
                .chain(Some(0))
                .collect::<Vec<u16>>()
        };
        let (verb, target) = (wide("open"), wide(u.as_str()));
        // SAFETY: both strings are NUL-terminated and live until the call returns.
        let r = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                verb.as_ptr(),
                target.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            )
        };
        if (r as isize) <= 32 {
            return Err(WebError::new(
                "FETCH_NETWORK",
                "the browser could not be opened",
            ));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = u;
        Err(WebError::new(
            "FETCH_NETWORK",
            "opening links is only built for Windows",
        ))
    }
}
