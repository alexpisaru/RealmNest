//! Skill packages on disk. A Skill is content (Markdown, JSON, YAML, CSV,
//! images), never code, and this module enforces that again, whatever the
//! page sent:
//!
//! - packages live in `<app data>/skills/<id>/`, written only here, atomically
//!   (a staging folder; the old version renamed to a backup, the new one renamed in,
//!   the backup deleted; any failure puts the old version back, and leftovers of an
//!   interrupted update are swept, or restored, at the next start or write);
//!   ids and logical paths are checked, no `..`, no absolute paths, no Windows device
//!   names, no links are followed;
//! - only allowed file types, size-capped; executables are refused by type
//!   and by content (MZ, ELF, #!);
//! - exports go to `Documents/RealmNest Skills/<id>-<version>.realmnest-skill` only (a legacy
//!   `.nestra-skill` name is still accepted);
//! - downloads are HTTPS only (redirects too), size-capped and time-limited,
//!   never with credentials; nothing downloaded is kept until the page installs it.

#[cfg(test)]
mod tests;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

pub const MAX_FILES: usize = 200;
pub const MAX_FILE_BYTES: usize = 1024 * 1024;
pub const MAX_TOTAL_BYTES: usize = 5 * 1024 * 1024;
pub const MAX_DOWNLOAD_BYTES: usize = 8 * 1024 * 1024;
const MAX_PATH: usize = 200;
const MAX_DEPTH: usize = 6;

const ALLOWED: [&str; 13] = [
    "md", "markdown", "txt", "json", "yaml", "yml", "csv", "tsv", "png", "jpg", "jpeg", "webp",
    "gif",
];
const PLAIN_NAMES: [&str; 5] = ["license", "licence", "notice", "readme", "copying"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WireFile {
    pub path: String,
    /// base64
    pub data: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Fetched {
    pub data: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
}

pub fn is_skill_id(v: &str) -> bool {
    // publisher.name: lowercase alphanumeric words joined by single hyphens, at least one dot
    if v.is_empty() || v.len() > 100 || !v.contains('.') {
        return false;
    }
    v.split('.').all(|part| {
        !part.is_empty()
            && part.split('-').all(|w| {
                !w.is_empty()
                    && w.bytes()
                        .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
            })
    })
}

/// A logical path inside a package, as its parts; Err with the reason.
pub fn package_path(raw: &str) -> Result<Vec<String>, String> {
    if raw.is_empty() || raw.len() > MAX_PATH || raw.contains('\\') || raw.starts_with('/') {
        return Err(format!("invalid path {}", short(raw)));
    }
    let parts: Vec<&str> = raw.split('/').collect();
    if parts.len() > MAX_DEPTH {
        return Err(format!("{} is nested too deeply", short(raw)));
    }
    for p in &parts {
        let ok = !p.is_empty()
            && p.len() <= 80
            && *p != "."
            && *p != ".."
            && !p.ends_with('.')
            && !p.ends_with(' ')
            && !is_device_name(p)
            && p.chars().all(|c| {
                c.is_ascii_alphanumeric() || matches!(c, ' ' | '_' | '.' | '(' | ')' | '+' | '-')
            });
        if !ok {
            return Err(format!("invalid path {}", short(raw)));
        }
    }
    let name = parts.last().unwrap().to_ascii_lowercase();
    let ext = name.rsplit_once('.').map(|(_, e)| e).unwrap_or("");
    let plain = !name.contains('.') && PLAIN_NAMES.contains(&name.as_str());
    if !plain && !ALLOWED.contains(&ext) {
        return Err(format!("{} is not an allowed file type", short(raw)));
    }
    if parts[0].eq_ignore_ascii_case("scripts") {
        return Err(format!("{}: scripts are never installed", short(raw)));
    }
    Ok(parts.iter().map(|p| p.to_string()).collect())
}

/// Windows device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9), whatever the extension:
/// `con.md` opens the console, not a file.
fn is_device_name(part: &str) -> bool {
    let stem = part
        .split('.')
        .next()
        .unwrap_or("")
        .trim_end_matches(' ')
        .to_ascii_uppercase();
    matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || ((stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem.len() == 4
            && matches!(stem.as_bytes()[3], b'1'..=b'9'))
}

/// Content that a computer could run is refused whatever its name.
pub fn looks_executable(bytes: &[u8]) -> bool {
    bytes.starts_with(b"MZ") || bytes.starts_with(b"\x7fELF") || bytes.starts_with(b"#!")
}

fn short(s: &str) -> String {
    s.chars().take(60).collect()
}

// ── base64 (standard alphabet, padded) ─────────────────────

const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub fn b64_encode(data: &[u8]) -> String {
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let n = (chunk[0] as u32) << 16
            | (*chunk.get(1).unwrap_or(&0) as u32) << 8
            | *chunk.get(2).unwrap_or(&0) as u32;
        out.push(B64[(n >> 18) as usize & 63] as char);
        out.push(B64[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 {
            B64[(n >> 6) as usize & 63] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            B64[n as usize & 63] as char
        } else {
            '='
        });
    }
    out
}

pub fn b64_decode(s: &str) -> Result<Vec<u8>, String> {
    let s = s.trim_end_matches('=');
    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    let mut buf = 0u32;
    let mut bits = 0;
    for c in s.bytes() {
        let v = match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => return Err("invalid base64".into()),
        } as u32;
        buf = buf << 6 | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
            buf &= (1 << bits) - 1;
        }
    }
    Ok(out)
}

// ── the store ──────────────────────────────────────────────

/// The renames and deletions that swap a package in (a test can make one fail).
pub trait FsOps: Send + Sync {
    fn rename(&self, from: &Path, to: &Path) -> std::io::Result<()>;
    fn remove_dir_all(&self, p: &Path) -> std::io::Result<()>;
}

struct RealFs;
impl FsOps for RealFs {
    fn rename(&self, from: &Path, to: &Path) -> std::io::Result<()> {
        fs::rename(from, to)
    }
    fn remove_dir_all(&self, p: &Path) -> std::io::Result<()> {
        fs::remove_dir_all(p)
    }
}

const STAGING: &str = ".staging-";
const BACKUP: &str = ".backup-";

pub struct SkillStore {
    root: PathBuf,
    exports: Option<PathBuf>,
    fs: Box<dyn FsOps>,
    /// one package change at a time (sweeping must never touch a write in progress)
    changing: Mutex<()>,
}

impl SkillStore {
    /// `root`: `<app data>/skills`; `exports`: `Documents/RealmNest Skills`
    pub fn new(root: PathBuf, exports: Option<PathBuf>) -> Self {
        Self::with_fs(root, exports, Box::new(RealFs))
    }

    pub fn with_fs(root: PathBuf, exports: Option<PathBuf>, fs: Box<dyn FsOps>) -> Self {
        let store = SkillStore {
            root,
            exports,
            fs,
            changing: Mutex::new(()),
        };
        // what an interrupted update left behind
        store.sweep();
        store
    }

    fn turn(&self) -> std::sync::MutexGuard<'_, ()> {
        self.changing.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Staging folders go; a backup comes back when its package is missing (the update
    /// stopped between the two renames), otherwise it goes too.
    fn sweep(&self) {
        let Ok(entries) = fs::read_dir(&self.root) else {
            return;
        };
        for e in entries.flatten() {
            let name = e.file_name().to_string_lossy().into_owned();
            let path = e.path();
            if is_link_path(&path) {
                continue;
            }
            if name.starts_with(STAGING) {
                let _ = self.fs.remove_dir_all(&path);
            } else if let Some(rest) = name.strip_prefix(BACKUP) {
                // .backup-<id>-<nanos>
                let id = rest
                    .rsplit_once('-')
                    .map(|(id, _)| id)
                    .filter(|id| is_skill_id(id));
                match id {
                    Some(id) if fs::symlink_metadata(self.root.join(id)).is_err() => {
                        let _ = self.fs.rename(&path, &self.root.join(id));
                    }
                    _ => {
                        let _ = self.fs.remove_dir_all(&path);
                    }
                }
            }
        }
    }

    /// staging → <id>, the old version kept aside until the new one is in place
    fn swap_in(&self, staging: &Path, dir: &Path, backup: &Path) -> Result<(), String> {
        let had_old = fs::symlink_metadata(dir).is_ok();
        if had_old {
            if is_link_path(dir) {
                return Err("the skill folder is a link".into());
            }
            self.fs.rename(dir, backup).map_err(|e| e.to_string())?;
        }
        if let Err(e) = self.fs.rename(staging, dir) {
            // put the old version back; if even that fails, the next sweep restores it
            if had_old {
                let _ = self.fs.rename(backup, dir);
            }
            return Err(e.to_string());
        }
        if had_old {
            // a backup that cannot be deleted now is swept later
            let _ = self.fs.remove_dir_all(backup);
        }
        Ok(())
    }

    fn dir_of(&self, id: &str) -> Result<PathBuf, String> {
        if !is_skill_id(id) {
            return Err("invalid skill id".into());
        }
        Ok(self.root.join(id))
    }

    /// Replace a Skill's package. Everything is checked before anything is written.
    pub fn write(&self, id: &str, files: &[WireFile]) -> Result<(), String> {
        let dir = self.dir_of(id)?;
        if files.is_empty() || files.len() > MAX_FILES {
            return Err("a package has 1 to 200 files".into());
        }
        let mut decoded = Vec::with_capacity(files.len());
        let mut total = 0usize;
        let mut seen = std::collections::HashSet::new();
        for f in files {
            let parts = package_path(&f.path)?;
            if !seen.insert(f.path.to_ascii_lowercase()) {
                return Err(format!("{} is listed twice", short(&f.path)));
            }
            let bytes = b64_decode(&f.data)?;
            if bytes.len() > MAX_FILE_BYTES {
                return Err(format!("{} is larger than 1 MB", short(&f.path)));
            }
            if looks_executable(&bytes) {
                return Err(format!("{} is executable content", short(&f.path)));
            }
            total += bytes.len();
            if total > MAX_TOTAL_BYTES {
                return Err("the package is larger than 5 MB".into());
            }
            decoded.push((parts, bytes));
        }
        fs::create_dir_all(&self.root).map_err(|e| e.to_string())?;
        if is_link_path(&self.root) {
            return Err("the skills folder is a link".into());
        }
        let _turn = self.turn();
        self.sweep();
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let staging = self.root.join(format!("{STAGING}{id}-{nanos}"));
        let backup = self.root.join(format!("{BACKUP}{id}-{nanos}"));
        let result = (|| -> Result<(), String> {
            fs::create_dir_all(&staging).map_err(|e| e.to_string())?;
            for (parts, bytes) in &decoded {
                let mut p = staging.clone();
                for (i, part) in parts.iter().enumerate() {
                    p.push(part);
                    if i + 1 < parts.len() {
                        fs::create_dir_all(&p).map_err(|e| e.to_string())?;
                    }
                }
                fs::write(&p, bytes).map_err(|e| e.to_string())?;
            }
            self.swap_in(&staging, &dir, &backup)
        })();
        if result.is_err() {
            let _ = fs::remove_dir_all(&staging);
        }
        result
    }

    /// The files of an installed package (regular files only; links are skipped).
    pub fn read(&self, id: &str) -> Result<Vec<WireFile>, String> {
        let dir = self.dir_of(id)?;
        let mut out = Vec::new();
        if !dir.is_dir() || is_link_path(&dir) {
            return Ok(out);
        }
        let mut total = 0usize;
        walk(&dir, &dir, 0, &mut |rel, path| {
            if package_path(rel).is_err() || out.len() >= MAX_FILES {
                return;
            }
            if let Ok(bytes) = fs::read(path) {
                total += bytes.len();
                if bytes.len() <= MAX_FILE_BYTES
                    && total <= MAX_TOTAL_BYTES
                    && !looks_executable(&bytes)
                {
                    out.push(WireFile {
                        path: rel.to_string(),
                        data: b64_encode(&bytes),
                    });
                }
            }
        });
        out.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(out)
    }

    pub fn read_file(&self, id: &str, rel: &str) -> Result<String, String> {
        let parts = package_path(rel)?;
        let mut p = self.dir_of(id)?;
        for part in &parts {
            p.push(part);
            if is_link_path(&p) {
                return Err("links are not followed".into());
            }
        }
        let meta = fs::metadata(&p).map_err(|_| format!("{} is not in this Skill", short(rel)))?;
        if !meta.is_file() || meta.len() as usize > MAX_FILE_BYTES {
            return Err(format!("{} cannot be read", short(rel)));
        }
        let bytes = fs::read(&p).map_err(|e| e.to_string())?;
        Ok(b64_encode(&bytes))
    }

    pub fn remove(&self, id: &str) -> Result<(), String> {
        let dir = self.dir_of(id)?;
        let _turn = self.turn();
        if !dir.exists() {
            return Ok(());
        }
        if is_link_path(&dir) {
            return Err("the skill folder is a link".into());
        }
        fs::remove_dir_all(&dir).map_err(|e| e.to_string())
    }

    /// Save an exported bundle in Documents/RealmNest Skills; returns its full path.
    pub fn export(&self, filename: &str, text: &str) -> Result<String, String> {
        let dir = self.exports.clone().ok_or("no Documents folder")?;
        let stem = filename
            .strip_suffix(".realmnest-skill")
            .or_else(|| filename.strip_suffix(".nestra-skill"))
            .ok_or("an export is a .realmnest-skill file")?;
        // <id>-<version>: the id rule, then a version
        let ok = stem.len() <= 140
            && stem
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '.' | '-'))
            && stem.contains('.');
        if !ok {
            return Err("invalid export file name".into());
        }
        if text.len() > MAX_TOTAL_BYTES * 2 {
            return Err("the export is too large".into());
        }
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let path = dir.join(filename);
        fs::write(&path, text).map_err(|e| e.to_string())?;
        Ok(path.to_string_lossy().into_owned())
    }
}

fn is_link_path(p: &Path) -> bool {
    fs::symlink_metadata(p)
        .map(|m| crate::tools::is_link(&m))
        .unwrap_or(false)
}

fn walk(root: &Path, dir: &Path, depth: usize, f: &mut dyn FnMut(&str, &Path)) {
    if depth > MAX_DEPTH {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for e in entries.flatten() {
        let path = e.path();
        let Ok(meta) = fs::symlink_metadata(&path) else {
            continue;
        };
        if crate::tools::is_link(&meta) {
            continue;
        }
        if meta.is_dir() {
            walk(root, &path, depth + 1, f);
        } else if meta.is_file() {
            if let Ok(rel) = path.strip_prefix(root) {
                let rel = rel.to_string_lossy().replace('\\', "/");
                f(&rel, &path);
            }
        }
    }
}

// ── download ───────────────────────────────────────────────

/// GET an https URL: public hosts only (no private / local addresses, checked again on every
/// redirect and at DNS resolution), no credentials, https-only redirects (at most 3), 20 s, 8 MB.
pub async fn fetch(url: &str) -> Result<Fetched, String> {
    let parsed = reqwest::Url::parse(url).map_err(|_| "not a valid address".to_string())?;
    if parsed.scheme() != "https" {
        return Err("only https:// addresses are allowed".into());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("addresses with a user name or password are not allowed".into());
    }
    crate::web::guard::check_url(&parsed, &crate::web::guard::Policy::PUBLIC).map_err(|b| b.0)?;
    let http = reqwest::Client::builder()
        .https_only(true)
        .no_proxy()
        // names resolve only to public addresses; every redirect is checked like the first URL
        .dns_resolver(std::sync::Arc::new(crate::web::guard::GuardResolver {
            policy: crate::web::guard::Policy::PUBLIC,
        }))
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 3 {
                attempt.error("too many redirects")
            } else if attempt.url().scheme() != "https" {
                attempt.error("redirect to a non-https address")
            } else if let Err(b) =
                crate::web::guard::check_url(attempt.url(), &crate::web::guard::Policy::PUBLIC)
            {
                attempt.error(format!("redirect blocked: {}", b.0))
            } else {
                attempt.follow()
            }
        }))
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(20))
        .user_agent("RealmNest")
        .build()
        .map_err(|e| e.to_string())?;
    let mut res = http.get(parsed).send().await.map_err(|e| {
        // say which rule stopped it: a redirect, a private address behind the name, or the network
        let chain = crate::web::error_chain(&e);
        [
            "redirect blocked:",
            "redirect to a non-https address",
            "too many redirects",
        ]
        .iter()
        .find_map(|p| chain.find(p))
        .map(|i| chain[i..].chars().take(160).collect::<String>())
        .unwrap_or_else(|| {
            format!(
                "download failed: {}",
                crate::web::map_send_error(&e).message
            )
        })
    })?;
    if !res.status().is_success() {
        return Err(format!("the server answered {}", res.status().as_u16()));
    }
    if res
        .content_length()
        .is_some_and(|n| n as usize > MAX_DOWNLOAD_BYTES)
    {
        return Err("the file is larger than 8 MB".into());
    }
    let final_url = res.url().to_string();
    let content_type = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.chars().take(100).collect());
    let mut body = Vec::new();
    while let Some(chunk) = res.chunk().await.map_err(|e| short(&e.to_string()))? {
        body.extend_from_slice(&chunk);
        if body.len() > MAX_DOWNLOAD_BYTES {
            return Err("the file is larger than 8 MB".into());
        }
    }
    Ok(Fetched {
        data: b64_encode(&body),
        url: final_url,
        content_type,
    })
}
