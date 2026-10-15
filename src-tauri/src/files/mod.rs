//! RealmNest's managed files: the bytes of attachments and artifacts, content-addressed.
//!
//! The webview never names a host path. It hands bytes in (or names a file inside a workspace) and
//! gets back a storage reference, `sha256:<64 hex>`. Everything else asks by that reference:
//! - blobs live in `<app data>/files/blobs/<2 hex>/<64 hex>`, written once (same content, same
//!   blob: logical attachments and artifacts stay separate records in the app);
//! - the type is sniffed from the first bytes, never taken from a name alone;
//! - sizes are capped (MAX_FILE_BYTES);
//! - "open" and "reveal" work on a named copy in `<app data>/files/open/`, marked as coming from
//!   the Internet; "open" only for an allowlist of documents and media whose bytes match their
//!   name (`may_open`), never programs, scripts or web pages;
//! - unreferenced blobs go to `files/trash/<date>/` for TRASH_DAYS before they are deleted;
//! - exports go through the system's save dialog (Windows) or to Documents/RealmNest Exports, as a
//!   copy: the managed original is never moved.

use serde::Serialize;
use std::fs;
use std::io::{ErrorKind, Read, Write};
use std::path::{Path, PathBuf};

pub mod dialog;
pub mod pdf;
pub mod sha256;
pub mod sniff;

/// the largest managed file (an attachment or an artifact)
pub const MAX_FILE_BYTES: usize = 32 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct FileErr {
    /// FILE_TOO_LARGE · INVALID_FILE · FILE_NOT_FOUND · IMPORT_FAILED · UNSUPPORTED_FILE_TYPE · CANCELLED
    pub code: String,
    pub message: String,
}

pub(crate) fn ferr(code: &str, message: impl Into<String>) -> FileErr {
    FileErr {
        code: code.into(),
        message: message.into(),
    }
}

/// What the store knows about a blob.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Stored {
    pub storage_ref: String,
    pub sha256: String,
    pub size: u64,
    /// sniffed from the content; None when nothing recognisable (plain text, unknown binary)
    pub mime: Option<String>,
    /// whether the content is UTF-8 text (no NUL bytes in the first 8 KB)
    pub text: bool,
}

pub struct FileStore {
    root: PathBuf,
    exports: Option<PathBuf>,
}

/// `sha256:<64 lowercase hex>` → the hex, or None (anything else is refused: no paths, no `..`)
pub fn parse_ref(r: &str) -> Option<&str> {
    let hex = r.strip_prefix("sha256:")?;
    (hex.len() == 64
        && hex
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)))
    .then_some(hex)
}

pub fn describe(bytes: &[u8]) -> Stored {
    let hex = sha256::hex(bytes);
    Stored {
        storage_ref: format!("sha256:{hex}"),
        sha256: hex,
        size: bytes.len() as u64,
        mime: sniff::mime(bytes).map(str::to_string),
        text: describe_text(bytes),
    }
}

/// RealmNest's one script in a report page (the contents follow the reading): the same file the
/// export writes, so the policy below can name it by its hash.
pub const REPORT_TOC_SCRIPT: &str = include_str!("../../../src/runtime/research/report-toc.js");

/// The policy every report page opened in a browser gets, whatever the page says: no frames,
/// forms, plugins or connections; inline styles; pictures only inline (the page carries them);
/// no script but RealmNest's contents script, named by its hash.
pub fn report_csp() -> String {
    use base64::Engine as _;
    use sha2::Digest as _;
    let hash = base64::engine::general_purpose::STANDARD
        .encode(sha2::Sha256::digest(REPORT_TOC_SCRIPT.trim().as_bytes()));
    format!("default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; script-src 'sha256-{hash}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
}

/// A report page (RealmNest's own HTML export) made safe to open in a browser. It must start
/// exactly like the export does, `<!doctype html><html …><head>` (only whitespace between), and
/// RealmNest's policy becomes the first child of <head>: no markup can come before it (two
/// policies both apply, so nothing in the page can loosen it).
pub fn report_page(html: &str) -> Result<String, FileErr> {
    if html.len() > 8 * 1024 * 1024 {
        return Err(ferr("FILE_TOO_LARGE", "The report page is too large."));
    }
    let at = report_head_end(html).ok_or_else(|| ferr("INVALID_FILE", "Not a report page."))?;
    Ok(format!(
        "{}<meta http-equiv=\"Content-Security-Policy\" content=\"{}\">{}",
        &html[..at],
        report_csp(),
        &html[at..]
    ))
}

/// Where `<!doctype html><html …><head>` ends, or None when the page starts any other way.
fn report_head_end(html: &str) -> Option<usize> {
    let b = html.as_bytes();
    let mut i = 0;
    if html.starts_with('\u{feff}') {
        i = '\u{feff}'.len_utf8();
    }
    let skip_ws = |mut i: usize| {
        while b.get(i).is_some_and(|c| c.is_ascii_whitespace()) {
            i += 1;
        }
        i
    };
    let lit = |i: usize, s: &str| {
        b.get(i..i + s.len())
            .is_some_and(|w| w.eq_ignore_ascii_case(s.as_bytes()))
            .then_some(i + s.len())
    };
    i = lit(skip_ws(i), "<!doctype html>")?;
    i = lit(skip_ws(i), "<html")?;
    // attributes up to the first '>' (no markup inside the tag)
    if !b
        .get(i)
        .is_some_and(|c| *c == b'>' || c.is_ascii_whitespace())
    {
        return None;
    }
    let close = i + b[i..].iter().position(|&c| c == b'>')?;
    if b[i..close].contains(&b'<') {
        return None;
    }
    lit(skip_ws(close + 1), "<head>")
}

/// A safe file name for a copy shown to the user (no folders, no reserved characters).
pub fn safe_name(name: &str) -> String {
    let base = name.rsplit(['/', '\\']).next().unwrap_or("file");
    let mut out: String = base
        .chars()
        .map(|c| {
            if c.is_control() || "<>:\"|?*".contains(c) {
                '_'
            } else {
                c
            }
        })
        .collect();
    out = out.trim().trim_end_matches(['.', ' ']).to_string();
    if out.is_empty() || out.starts_with('.') {
        out = format!("file{out}");
    }
    // CON, NUL, COM1… name a device whatever the extension
    if is_device_name(&out) {
        out = format!("_{out}");
    }
    out.chars().take(120).collect()
}

fn is_device_name(name: &str) -> bool {
    let stem = name
        .split('.')
        .next()
        .unwrap_or("")
        .trim_end()
        .to_ascii_uppercase();
    matches!(
        stem.as_str(),
        "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$"
    ) || ((stem.starts_with("COM") || stem.starts_with("LPT"))
        && stem.len() == 4
        && stem.as_bytes()[3].is_ascii_digit())
}

/// What the bytes of an openable kind must look like.
#[derive(Clone, Copy)]
enum Expect {
    Mime(&'static str),
    /// Office / OpenDocument files are zip packages
    Zip,
    Bmp,
    Rtf,
    Mp3,
    /// plain UTF-8 text that is not markup or a script
    Text,
}

/// The only kinds RealmNest opens with the system's default app: documents and media. Anything
/// else (programs, scripts, disk images, shortcuts, web pages, SVG…) can only be exported.
const OPENABLE: &[(&str, Expect)] = &[
    ("pdf", Expect::Mime("application/pdf")),
    ("png", Expect::Mime("image/png")),
    ("jpg", Expect::Mime("image/jpeg")),
    ("jpeg", Expect::Mime("image/jpeg")),
    ("gif", Expect::Mime("image/gif")),
    ("webp", Expect::Mime("image/webp")),
    ("bmp", Expect::Bmp),
    ("txt", Expect::Text),
    ("md", Expect::Text),
    ("csv", Expect::Text),
    ("json", Expect::Text),
    ("log", Expect::Text),
    ("docx", Expect::Zip),
    ("xlsx", Expect::Zip),
    ("pptx", Expect::Zip),
    ("odt", Expect::Zip),
    ("ods", Expect::Zip),
    ("odp", Expect::Zip),
    ("rtf", Expect::Rtf),
    ("mp3", Expect::Mp3),
    ("wav", Expect::Mime("audio/wav")),
    ("mp4", Expect::Mime("video/mp4")),
    ("webm", Expect::Mime("video/webm")),
];

/// Whether a file with this name and these bytes may be opened: the name as it would be written
/// (`safe_name`: Windows drops trailing dots and spaces) must have an allowed extension, and the
/// content must really be that kind (an executable renamed `.pdf` is refused).
pub fn may_open(name: &str, bytes: &[u8]) -> bool {
    let file = safe_name(name);
    let Some((_, ext)) = file.rsplit_once('.') else {
        return false;
    };
    let ext = ext.to_ascii_lowercase();
    let Some((_, expect)) = OPENABLE.iter().find(|(e, _)| *e == ext) else {
        return false;
    };
    let sniffed = sniff::mime(bytes);
    match expect {
        Expect::Mime(m) => sniffed == Some(*m),
        Expect::Zip => sniffed == Some("application/zip"),
        Expect::Bmp => bytes.starts_with(b"BM") && bytes.len() >= 26,
        Expect::Rtf => bytes.starts_with(b"{\\rtf"),
        Expect::Mp3 => {
            sniffed == Some("audio/mpeg")
                || (bytes.len() >= 2 && bytes[0] == 0xff && bytes[1] & 0xe0 == 0xe0)
        }
        Expect::Text => {
            let head = String::from_utf8_lossy(&bytes[..bytes.len().min(512)]);
            sniffed.is_none()
                && describe_text(bytes)
                && !head.trim_start_matches('\u{feff}').starts_with("#!")
        }
    }
}

/// UTF-8 without NULs in the first 8 KB (a character cut at the boundary is fine)
fn describe_text(bytes: &[u8]) -> bool {
    let head = &bytes[..bytes.len().min(8192)];
    !head.contains(&0)
        && match std::str::from_utf8(head) {
            Ok(_) => true,
            Err(e) => e.error_len().is_none(),
        }
}

/// Mark a copy as coming from the Internet (Mark-of-the-Web, zone 3), so the app that opens it
/// uses its protected mode. Best effort: not every volume has alternate data streams.
fn mark_of_the_web(path: &Path) {
    #[cfg(windows)]
    {
        let mut ads = path.as_os_str().to_owned();
        ads.push(":Zone.Identifier");
        let _ = fs::write(PathBuf::from(ads), b"[ZoneTransfer]\r\nZoneId=3\r\n");
    }
    #[cfg(not(windows))]
    let _ = path;
}

impl FileStore {
    pub fn new(root: PathBuf, exports: Option<PathBuf>) -> Self {
        Self { root, exports }
    }

    fn blob(&self, hex: &str) -> PathBuf {
        self.root.join("blobs").join(&hex[..2]).join(hex)
    }

    /// Keep these bytes (once per content).
    pub fn put(&self, bytes: &[u8]) -> Result<Stored, FileErr> {
        if bytes.len() > MAX_FILE_BYTES {
            return Err(ferr(
                "FILE_TOO_LARGE",
                format!(
                    "The file is {} bytes; the limit is {MAX_FILE_BYTES}.",
                    bytes.len()
                ),
            ));
        }
        let s = describe(bytes);
        let path = self.blob(&s.sha256);
        if path.is_file() {
            return Ok(s);
        }
        let dir = path.parent().expect("blob folder");
        fs::create_dir_all(dir).map_err(|_| {
            ferr(
                "IMPORT_FAILED",
                "RealmNest's file folder cannot be created.",
            )
        })?;
        // write next to it, then rename: a blob is never half written
        let tmp = dir.join(format!("{}.tmp", s.sha256));
        let _ = fs::remove_file(&tmp);
        let mut f = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&tmp)
            .map_err(|_| ferr("IMPORT_FAILED", "The file cannot be stored."))?;
        f.write_all(bytes)
            .map_err(|_| ferr("IMPORT_FAILED", "The file cannot be stored."))?;
        drop(f);
        fs::rename(&tmp, &path)
            .or_else(|e| if path.is_file() { Ok(()) } else { Err(e) })
            .map_err(|_| ferr("IMPORT_FAILED", "The file cannot be stored."))?;
        Ok(s)
    }

    /// The bytes behind a reference, checked against their hash.
    pub fn get(&self, storage_ref: &str) -> Result<Vec<u8>, FileErr> {
        let hex = parse_ref(storage_ref)
            .ok_or_else(|| ferr("INVALID_FILE", "Not a storage reference."))?;
        let path = self.blob(hex);
        if !path.is_file() {
            self.restore_from_trash(hex);
        }
        let meta =
            fs::metadata(&path).map_err(|_| ferr("FILE_NOT_FOUND", "The managed file is gone."))?;
        if meta.len() as usize > MAX_FILE_BYTES {
            return Err(ferr("FILE_TOO_LARGE", "The managed file is too large."));
        }
        let mut bytes = Vec::with_capacity(meta.len() as usize);
        fs::File::open(&path)
            .and_then(|mut f| f.read_to_end(&mut bytes))
            .map_err(|_| ferr("FILE_NOT_FOUND", "The managed file cannot be read."))?;
        if sha256::hex(&bytes) != hex {
            return Err(ferr(
                "FILE_CHANGED",
                "The managed file was changed outside RealmNest.",
            ));
        }
        Ok(bytes)
    }

    pub fn exists(&self, storage_ref: &str) -> bool {
        parse_ref(storage_ref)
            .is_some_and(|hex| self.blob(hex).is_file() || self.restore_from_trash(hex))
    }

    /// Delete a blob (the app calls this only when no record references it any more).
    pub fn delete(&self, storage_ref: &str) -> Result<bool, FileErr> {
        let hex = parse_ref(storage_ref)
            .ok_or_else(|| ferr("INVALID_FILE", "Not a storage reference."))?;
        match fs::remove_file(self.blob(hex)) {
            Ok(()) => Ok(true),
            Err(e) if e.kind() == ErrorKind::NotFound => Ok(false),
            Err(_) => Err(ferr("IMPORT_FAILED", "The managed file cannot be deleted.")),
        }
    }

    /// Keep a copy of a file inside a workspace (an output a tool wrote there).
    pub fn import_workspace(
        &self,
        workspace: &str,
        rel: &str,
    ) -> Result<(Stored, String), FileErr> {
        let (path, shown) = crate::tools::existing_file(workspace, rel).map_err(|e| {
            ferr(
                if e.code == "FILE_NOT_FOUND" {
                    "FILE_NOT_FOUND"
                } else {
                    "INVALID_FILE"
                },
                e.message,
            )
        })?;
        let meta = fs::metadata(&path)
            .map_err(|_| ferr("FILE_NOT_FOUND", format!("{rel} cannot be opened.")))?;
        if meta.len() as usize > MAX_FILE_BYTES {
            return Err(ferr(
                "FILE_TOO_LARGE",
                format!(
                    "{rel} is {} bytes; the limit is {MAX_FILE_BYTES}.",
                    meta.len()
                ),
            ));
        }
        let bytes =
            fs::read(&path).map_err(|_| ferr("IMPORT_FAILED", format!("{rel} cannot be read.")))?;
        Ok((self.put(&bytes)?, shown))
    }

    /// Write a managed file into a workspace (so a tool, e.g. an MCP server, can open it there).
    pub fn to_workspace(
        &self,
        storage_ref: &str,
        workspace: &str,
        rel: &str,
    ) -> Result<crate::tools::Written, FileErr> {
        let bytes = self.get(storage_ref)?;
        crate::tools::write_bytes(workspace, rel, &bytes).map_err(|e| {
            ferr(
                if e.code == "PATH_OUTSIDE_WORKSPACE" {
                    "INVALID_FILE"
                } else {
                    "IMPORT_FAILED"
                },
                e.message,
            )
        })
    }

    /// A research report page written for the user's browser, in a folder every browser can read
    /// (`Documents/RealmNest Exports/Reports/<name>.html`), locked by `report_page`; overwritten on
    /// every open (the latest version).
    pub fn report_copy(&self, name: &str, html: &str) -> Result<PathBuf, FileErr> {
        let page = report_page(html)?;
        let mut file = safe_name(name);
        if !file.to_ascii_lowercase().ends_with(".html") {
            file.push_str(".html");
        }
        // a folder every browser can read (Documents), not the app's own data folder
        let dir = self
            .exports
            .as_ref()
            .map(|e| e.join("Reports"))
            .unwrap_or_else(|| self.root.join("reports"));
        fs::create_dir_all(&dir)
            .map_err(|_| ferr("IMPORT_FAILED", "The page cannot be written."))?;
        let path = dir.join(file);
        fs::write(&path, page).map_err(|_| ferr("IMPORT_FAILED", "The page cannot be written."))?;
        Ok(path)
    }

    /// A named copy for opening or revealing (`open/<sha prefix>/<name>`), made once.
    pub fn named_copy(&self, storage_ref: &str, name: &str) -> Result<PathBuf, FileErr> {
        let path = self.copy_path(storage_ref, name)?;
        if !path.is_file() {
            let bytes = self.get(storage_ref)?;
            write_copy(&path, &bytes)?;
            // a copy shown in the file manager may be double-clicked there
            mark_of_the_web(&path);
        }
        Ok(path)
    }

    /// A named copy to open with the system's default app: only documents and media whose bytes
    /// match their name (`may_open`), marked as coming from the Internet.
    pub fn open_copy(&self, storage_ref: &str, name: &str) -> Result<PathBuf, FileErr> {
        let path = self.copy_path(storage_ref, name)?;
        let bytes = self.get(storage_ref)?;
        if !may_open(name, &bytes) {
            return Err(ferr(
                "UNSUPPORTED_FILE_TYPE",
                "RealmNest does not open this kind of file: export a copy instead.",
            ));
        }
        if !path.is_file() {
            write_copy(&path, &bytes)?;
        }
        mark_of_the_web(&path);
        Ok(path)
    }

    fn copy_path(&self, storage_ref: &str, name: &str) -> Result<PathBuf, FileErr> {
        let hex = parse_ref(storage_ref)
            .ok_or_else(|| ferr("INVALID_FILE", "Not a storage reference."))?;
        Ok(self
            .root
            .join("open")
            .join(&hex[..16])
            .join(safe_name(name)))
    }

    /// Where an export goes when there is no dialog: Documents/RealmNest Exports, never overwriting.
    pub fn export_default(&self, storage_ref: &str, name: &str) -> Result<PathBuf, FileErr> {
        let dir = self
            .exports
            .clone()
            .ok_or_else(|| ferr("IMPORT_FAILED", "No exports folder."))?;
        fs::create_dir_all(&dir)
            .map_err(|_| ferr("IMPORT_FAILED", "The exports folder cannot be created."))?;
        let name = safe_name(name);
        let (stem, ext) = match name.rsplit_once('.') {
            Some((s, e)) if !s.is_empty() => (s.to_string(), format!(".{e}")),
            _ => (name.clone(), String::new()),
        };
        let mut path = dir.join(&name);
        let mut n = 2;
        while path.exists() {
            path = dir.join(format!("{stem} ({n}){ext}"));
            n += 1;
        }
        self.copy_to(storage_ref, &path)?;
        Ok(path)
    }

    /// Copy a managed file to a path the user chose (never moves the original).
    pub fn copy_to(&self, storage_ref: &str, path: &Path) -> Result<(), FileErr> {
        let bytes = self.get(storage_ref)?;
        fs::write(path, bytes)
            .map_err(|_| ferr("IMPORT_FAILED", "The copy cannot be written there."))
    }

    /// Move blobs no record references (`keep`), older than `min_age` (a file being attached
    /// right now is younger), to `trash/<today>/` (a lost record can still get its file back for
    /// TRASH_DAYS), delete trash older than that, and remove the named copies made for opening.
    /// Never follows links.
    pub fn collect(
        &self,
        keep: &std::collections::HashSet<String>,
        min_age: std::time::Duration,
    ) -> Usage {
        let mut u = Usage::default();
        let now = std::time::SystemTime::now();
        let today = now
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| (d.as_secs() / 86_400) as i64)
            .unwrap_or(0);
        u.purged = self.purge_trash(today);
        let trash = self.root.join("trash").join(day_name(today));
        let old = |m: &fs::Metadata| {
            m.modified()
                .ok()
                .and_then(|t| now.duration_since(t).ok())
                .is_some_and(|d| d >= min_age)
        };
        let Ok(shards) = fs::read_dir(self.root.join("blobs")) else {
            return u;
        };
        for shard in shards.flatten() {
            let Ok(ft) = shard.file_type() else { continue };
            if !ft.is_dir() {
                continue;
            }
            let Ok(files) = fs::read_dir(shard.path()) else {
                continue;
            };
            for f in files.flatten() {
                let Ok(m) = f.metadata() else { continue };
                if !m.is_file() {
                    continue;
                }
                let name = f.file_name().to_string_lossy().to_string();
                let referenced = parse_ref(&format!("sha256:{name}")).is_some()
                    && keep.contains(&format!("sha256:{name}"));
                if referenced || !old(&m) {
                    u.kept += 1;
                    u.kept_bytes += m.len();
                } else if fs::create_dir_all(&trash).is_ok()
                    && fs::rename(f.path(), trash.join(&name)).is_ok()
                {
                    u.removed += 1;
                    u.removed_bytes += m.len();
                }
            }
        }
        // copies for opening are made again when needed
        if let Ok(dirs) = fs::read_dir(self.root.join("open")) {
            for d in dirs.flatten() {
                if d.file_type().is_ok_and(|t| t.is_dir()) && d.metadata().is_ok_and(|m| old(&m)) {
                    let _ = fs::remove_dir_all(d.path());
                }
            }
        }
        u
    }

    /// Delete the trash folders older than TRASH_DAYS (only `YYYY-MM-DD` folders); how many.
    fn purge_trash(&self, today: i64) -> u64 {
        let mut n = 0;
        let Ok(days) = fs::read_dir(self.root.join("trash")) else {
            return 0;
        };
        for d in days.flatten() {
            let name = d.file_name().to_string_lossy().to_string();
            let expired = day_number(&name).is_some_and(|day| today - day > TRASH_DAYS);
            if expired
                && d.file_type().is_ok_and(|t| t.is_dir())
                && fs::remove_dir_all(d.path()).is_ok()
            {
                n += 1;
            }
        }
        n
    }

    /// A collected blob a record asks for again: moved back from the trash (newest copy).
    fn restore_from_trash(&self, hex: &str) -> bool {
        let Ok(days) = fs::read_dir(self.root.join("trash")) else {
            return false;
        };
        let mut found: Vec<PathBuf> = days
            .flatten()
            .map(|d| d.path().join(hex))
            .filter(|p| p.is_file())
            .collect();
        found.sort();
        let Some(src) = found.pop() else {
            return false;
        };
        let dst = self.blob(hex);
        dst.parent().is_some_and(|d| fs::create_dir_all(d).is_ok())
            && (fs::rename(&src, &dst).is_ok() || dst.is_file())
    }
}

fn write_copy(path: &Path, bytes: &[u8]) -> Result<(), FileErr> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|_| ferr("IMPORT_FAILED", "The copy cannot be made."))?;
    }
    fs::write(path, bytes).map_err(|_| ferr("IMPORT_FAILED", "The copy cannot be made."))
}

/// How long collected blobs stay in `files/trash/<date>/` before they are deleted for good.
pub const TRASH_DAYS: i64 = 30;

/// Days since 1970-01-01 → "YYYY-MM-DD" (proleptic Gregorian, UTC).
pub fn day_name(days: i64) -> String {
    // Howard Hinnant's civil_from_days
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!("{y:04}-{m:02}-{d:02}")
}

/// "YYYY-MM-DD" → days since 1970-01-01, or None for any other name.
pub fn day_number(name: &str) -> Option<i64> {
    let b = name.as_bytes();
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-' {
        return None;
    }
    let num = |s: &str| s.parse::<i64>().ok();
    let (y, m, d) = (num(&name[..4])?, num(&name[5..7])?, num(&name[8..])?);
    if !(1..=12).contains(&m) || !(1..=31).contains(&d) {
        return None;
    }
    // Howard Hinnant's days_from_civil
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y.rem_euclid(400);
    let mp = if m > 2 { m - 3 } else { m + 9 };
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(era * 146_097 + doe - 719_468)
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
    pub kept: u64,
    pub kept_bytes: u64,
    /// moved to the trash this time
    pub removed: u64,
    pub removed_bytes: u64,
    /// trash folders (days) deleted for good
    pub purged: u64,
}

#[cfg(test)]
mod tests;
