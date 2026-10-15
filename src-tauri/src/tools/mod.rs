//! Native file tools for RealmNest's Tool Runtime: list a folder, read a text
//! file, write a text file — always inside one workspace folder.
//!
//! The webview only names the workspace and a *relative* path. Everything that
//! decides what is touched happens here:
//! - the workspace must be an existing absolute folder (not a drive root), and never a system,
//!   AppData, account-key or RealmNest data folder, a folder holding one, or the user folder
//!   itself (`refused_root`); writes are checked against the same list again;
//! - relative paths may not be absolute, name a drive, be UNC, contain `:`
//!   (drive or alternate data stream), `..`, Windows device names, or names
//!   ending in a dot or space;
//! - reads and listings canonicalize the target and refuse anything outside
//!   the canonical workspace (a link or junction leading out is caught);
//! - writes never pass through a link or junction, create folders one by one
//!   with the same check, and replace the file atomically (temp file + rename);
//! - sizes are capped (constants below).
//!
//! There is no generic filesystem command: three narrow ones in commands.rs.

use serde::Serialize;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

pub const MAX_READ_BYTES: u64 = 256 * 1024;
pub const MAX_WRITE_BYTES: usize = 256 * 1024;
pub const MAX_LIST_ENTRIES: usize = 500;
pub const MAX_PATH_CHARS: usize = 512;

/// A failure with one of the Tool Runtime's error codes (domain/tool.ts).
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ToolErr {
    pub code: String,
    pub message: String,
}

fn err(code: &str, message: impl Into<String>) -> ToolErr {
    ToolErr {
        code: code.into(),
        message: message.into(),
    }
}

fn outside(what: &str) -> ToolErr {
    err(
        "PATH_OUTSIDE_WORKSPACE",
        format!("{what}: only paths inside the workspace folder are allowed."),
    )
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DirEntry {
    pub name: String,
    /// file · dir · link (links and junctions are listed, never followed)
    pub kind: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Listing {
    pub path: String,
    pub entries: Vec<DirEntry>,
    pub truncated: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct TextFile {
    pub path: String,
    pub content: String,
    pub bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Written {
    pub path: String,
    pub bytes: u64,
    pub created: bool,
}

/// The canonical workspace folder.
pub fn workspace_root(workspace: &str) -> Result<PathBuf, ToolErr> {
    let ws = workspace.trim();
    if ws.is_empty() {
        return Err(err("WORKSPACE_REQUIRED", "No workspace folder is set."));
    }
    let p = Path::new(ws);
    if !p.is_absolute() {
        return Err(err(
            "WORKSPACE_REQUIRED",
            "The workspace must be a full folder path.",
        ));
    }
    let root = fs::canonicalize(p)
        .map_err(|_| err("WORKSPACE_REQUIRED", "The workspace folder does not exist."))?;
    if !root.is_dir() {
        return Err(err("WORKSPACE_REQUIRED", "The workspace is not a folder."));
    }
    if root.parent().is_none() {
        return Err(err(
            "WORKSPACE_REQUIRED",
            "A whole drive cannot be a workspace: choose a folder.",
        ));
    }
    if let Some(what) = refused_root(&norm(&root), &guards(), scratch().as_deref()) {
        return Err(err(
            "WORKSPACE_REQUIRED",
            format!("This folder cannot be a workspace: it is, holds or is inside {what}. Choose a project folder (for example one in Documents)."),
        ));
    }
    Ok(root)
}

// ── folders a workspace may never be, hold or be inside ──

/// RealmNest's own data folders (set once at startup).
pub static APP_DIRS: std::sync::OnceLock<Vec<PathBuf>> = std::sync::OnceLock::new();

/// A protected folder, normalised (`norm`). `tree`: everything inside it is protected too;
/// otherwise only the folder itself (the user profile: its subfolders are where projects live).
#[derive(Debug, Clone)]
pub struct Guard {
    pub path: String,
    pub tree: bool,
    pub what: &'static str,
}

/// A path for comparing: canonical when it exists, no `\\?\` prefix, `\` separators and
/// lower case on Windows, no trailing separator.
pub fn norm(p: &Path) -> String {
    let p = fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf());
    let s = p.to_string_lossy().to_string();
    if cfg!(windows) {
        let s = s.replace('/', "\\");
        let s = if let Some(unc) = s.strip_prefix(r"\\?\UNC\") {
            format!(r"\\{unc}")
        } else {
            s.strip_prefix(r"\\?\").map(str::to_string).unwrap_or(s)
        };
        s.trim_end_matches('\\').to_lowercase()
    } else {
        s.trim_end_matches('/').to_string()
    }
}

fn strictly_inside(p: &str, dir: &str) -> bool {
    let sep = if cfg!(windows) { '\\' } else { '/' };
    !dir.is_empty() && p.len() > dir.len() && p.starts_with(dir) && p[dir.len()..].starts_with(sep)
}

/// The protected folders of this computer and user.
pub fn guards() -> Vec<Guard> {
    let var = |k: &str| {
        std::env::var_os(k)
            .filter(|v| !v.is_empty())
            .map(PathBuf::from)
    };
    let mut out: Vec<Guard> = Vec::new();
    let mut add = |p: Option<PathBuf>, tree: bool, what: &'static str| {
        if let Some(p) = p.filter(|p| p.is_absolute()) {
            out.push(Guard {
                path: norm(&p),
                tree,
                what,
            });
        }
    };
    for d in APP_DIRS.get().into_iter().flatten() {
        add(Some(d.clone()), true, "RealmNest's own data folder");
    }
    add(var("APPDATA"), true, "the AppData folder");
    add(var("LOCALAPPDATA"), true, "the AppData folder");
    add(
        var("SystemRoot").or_else(|| var("windir")),
        true,
        "the Windows folder",
    );
    for k in [
        "ProgramFiles",
        "ProgramFiles(x86)",
        "ProgramW6432",
        "ProgramData",
    ] {
        add(var(k), true, "a system programs folder");
    }
    let home = var(if cfg!(windows) { "USERPROFILE" } else { "HOME" });
    add(home.clone(), false, "your user folder");
    if let Some(h) = home {
        for d in [".ssh", ".claude", ".codex", ".aws", ".config", ".gnupg"] {
            add(
                Some(h.join(d)),
                true,
                "a folder of account keys or settings",
            );
        }
        if cfg!(windows) {
            add(Some(h.join("AppData")), true, "the AppData folder");
        }
    }
    out
}

/// The system's temporary folder: its subfolders stay usable (scratch workspaces), although it
/// lives inside AppData.
fn scratch() -> Option<String> {
    let t = std::env::temp_dir();
    t.is_absolute().then(|| norm(&t))
}

/// Why `root` (normalised) cannot be a workspace, or None. Refused: a protected folder itself,
/// any folder holding one, and anything inside a `tree` one (except subfolders of `scratch`
/// where the protected folder only holds the scratch folder).
pub fn refused_root(root: &str, guards: &[Guard], scratch: Option<&str>) -> Option<&'static str> {
    guards.iter().find_map(|g| {
        let hit = root == g.path
            || strictly_inside(&g.path, root)
            || (g.tree && strictly_inside(root, &g.path) && !exempt(root, &g.path, scratch));
        hit.then_some(g.what)
    })
}

/// Whether a path (normalised) lies inside a protected folder (writes are checked again with it).
pub fn in_protected(path: &str, guards: &[Guard], scratch: Option<&str>) -> bool {
    guards.iter().any(|g| {
        g.tree
            && (path == g.path || strictly_inside(path, &g.path))
            && !exempt(path, &g.path, scratch)
    })
}

/// inside the scratch folder, which this protected folder merely contains
fn exempt(p: &str, guard: &str, scratch: Option<&str>) -> bool {
    scratch.is_some_and(|t| strictly_inside(p, t) && (t == guard || strictly_inside(t, guard)))
}

fn is_device_name(part: &str) -> bool {
    let stem = part.split('.').next().unwrap_or("").to_ascii_uppercase();
    matches!(
        stem.as_str(),
        "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$"
    ) || ((stem.starts_with("COM") || stem.starts_with("LPT"))
        && stem.len() == 4
        && stem.as_bytes()[3].is_ascii_digit())
}

/// The parts of a workspace-relative path, or why it is not one.
pub fn relative_parts(rel: &str, allow_root: bool) -> Result<Vec<String>, ToolErr> {
    if rel.chars().count() > MAX_PATH_CHARS {
        return Err(err("INVALID_TOOL_INPUT", "The path is too long."));
    }
    if rel.contains('\0') {
        return Err(err(
            "INVALID_TOOL_INPUT",
            "The path contains a NUL character.",
        ));
    }
    let rel = rel.trim();
    // absolute (/x, \x), UNC (\\server), drive (C:) or alternate data stream (a:b)
    if rel.starts_with('/') || rel.starts_with('\\') || rel.contains(':') {
        return Err(outside(rel));
    }
    let mut parts = Vec::new();
    for part in rel.split(['/', '\\']) {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            return Err(outside(rel));
        }
        // Windows silently drops trailing dots and spaces, so "a." would be "a"
        if part.ends_with('.') || part.ends_with(' ') || is_device_name(part) {
            return Err(err(
                "INVALID_TOOL_INPUT",
                format!("\"{part}\" is not a usable file name."),
            ));
        }
        if part
            .chars()
            .any(|c| matches!(c, '<' | '>' | '"' | '|' | '?' | '*') || (c as u32) < 32)
        {
            return Err(err(
                "INVALID_TOOL_INPUT",
                format!("\"{part}\" contains characters a file name cannot have."),
            ));
        }
        parts.push(part.to_string());
    }
    if parts.is_empty() && !allow_root {
        return Err(err("INVALID_TOOL_INPUT", "A file path is required."));
    }
    Ok(parts)
}

/// A link, junction or other reparse point (never followed by writes).
pub(crate) fn is_link(meta: &fs::Metadata) -> bool {
    if meta.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
        if meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return true;
        }
    }
    false
}

fn shown(root: &Path, p: &Path) -> String {
    let rel = p.strip_prefix(root).unwrap_or(p);
    let s = rel.to_string_lossy().replace('\\', "/");
    if s.is_empty() {
        ".".into()
    } else {
        s
    }
}

/// An existing path inside the workspace, canonical (links resolved and checked).
fn existing(root: &Path, rel: &str, allow_root: bool) -> Result<PathBuf, ToolErr> {
    let parts = relative_parts(rel, allow_root)?;
    let joined = parts
        .iter()
        .fold(root.to_path_buf(), |p, part| p.join(part));
    let real = fs::canonicalize(&joined).map_err(|e| match e.kind() {
        ErrorKind::NotFound => err("FILE_NOT_FOUND", format!("{rel} does not exist.")),
        _ => err("TOOL_EXECUTION_FAILED", format!("{rel} cannot be opened.")),
    })?;
    if !real.starts_with(root) || protected(&real) {
        return Err(outside(rel));
    }
    Ok(real)
}

/// defence in depth: a path inside a protected folder is refused whatever the workspace
fn protected(p: &Path) -> bool {
    in_protected(&norm(p), &guards(), scratch().as_deref())
}

pub fn list_directory(workspace: &str, rel: &str) -> Result<Listing, ToolErr> {
    let root = workspace_root(workspace)?;
    let dir = existing(&root, rel, true)?;
    if !dir.is_dir() {
        return Err(err("FILE_NOT_FOUND", format!("{rel} is not a folder.")));
    }
    let read = fs::read_dir(&dir)
        .map_err(|_| err("TOOL_EXECUTION_FAILED", format!("{rel} cannot be read.")))?;
    let mut entries = Vec::new();
    let mut truncated = false;
    for entry in read.flatten() {
        if entries.len() >= MAX_LIST_ENTRIES {
            truncated = true;
            break;
        }
        let Ok(meta) = fs::symlink_metadata(entry.path()) else {
            continue;
        };
        let (kind, size) = if is_link(&meta) {
            ("link", None)
        } else if meta.is_dir() {
            ("dir", None)
        } else {
            ("file", Some(meta.len()))
        };
        entries.push(DirEntry {
            name: entry.file_name().to_string_lossy().into_owned(),
            kind,
            size,
        });
    }
    entries.sort_by(|a, b| {
        (a.kind != "dir")
            .cmp(&(b.kind != "dir"))
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(Listing {
        path: shown(&root, &dir),
        entries,
        truncated,
    })
}

pub fn read_text(workspace: &str, rel: &str) -> Result<TextFile, ToolErr> {
    let root = workspace_root(workspace)?;
    let path = existing(&root, rel, false)?;
    let meta = fs::metadata(&path)
        .map_err(|_| err("FILE_NOT_FOUND", format!("{rel} cannot be opened.")))?;
    if !meta.is_file() {
        return Err(err("FILE_NOT_FOUND", format!("{rel} is not a file.")));
    }
    if meta.len() > MAX_READ_BYTES {
        return Err(err(
            "FILE_TOO_LARGE",
            format!(
                "{rel} is {} bytes; the limit is {MAX_READ_BYTES}.",
                meta.len()
            ),
        ));
    }
    // never more than the cap, even if the file grew since it was measured
    let mut bytes = Vec::new();
    {
        use std::io::Read;
        fs::File::open(&path)
            .and_then(|f| f.take(MAX_READ_BYTES + 1).read_to_end(&mut bytes))
            .map_err(|_| err("TOOL_EXECUTION_FAILED", format!("{rel} cannot be read.")))?;
    }
    if bytes.len() as u64 > MAX_READ_BYTES {
        return Err(err(
            "FILE_TOO_LARGE",
            format!("{rel} is larger than the limit of {MAX_READ_BYTES} bytes."),
        ));
    }
    let content = String::from_utf8(bytes)
        .map_err(|_| err("NOT_A_TEXT_FILE", format!("{rel} is not UTF-8 text.")))?;
    Ok(TextFile {
        path: shown(&root, &path),
        bytes: content.len() as u64,
        content,
    })
}

pub fn write_text(workspace: &str, rel: &str, content: &str) -> Result<Written, ToolErr> {
    if content.len() > MAX_WRITE_BYTES {
        return Err(err(
            "FILE_TOO_LARGE",
            format!(
                "The text is {} bytes; the limit is {MAX_WRITE_BYTES}.",
                content.len()
            ),
        ));
    }
    write_bytes(workspace, rel, content.as_bytes())
}

/// An existing file inside the workspace, canonical (links resolved and checked).
pub(crate) fn existing_file(workspace: &str, rel: &str) -> Result<(PathBuf, String), ToolErr> {
    let root = workspace_root(workspace)?;
    let path = existing(&root, rel, false)?;
    if !path.is_file() {
        return Err(err("FILE_NOT_FOUND", format!("{rel} is not a file.")));
    }
    let name = shown(&root, &path);
    Ok((path, name))
}

/// Create or replace a file inside the workspace with these bytes (callers cap the size).
pub(crate) fn write_bytes(workspace: &str, rel: &str, bytes: &[u8]) -> Result<Written, ToolErr> {
    let root = workspace_root(workspace)?;
    let parts = relative_parts(rel, false)?;
    let (name, folders) = parts.split_last().expect("at least one part");
    // walk (and create) the folders one by one, never through a link
    let mut dir = root.clone();
    for part in folders {
        let next = dir.join(part);
        match fs::symlink_metadata(&next) {
            Ok(meta) if is_link(&meta) => return Err(outside(rel)),
            Ok(meta) if !meta.is_dir() => {
                return Err(err(
                    "TOOL_EXECUTION_FAILED",
                    format!("{part} is a file, not a folder."),
                ))
            }
            Ok(_) => {}
            Err(e) if e.kind() == ErrorKind::NotFound => {
                fs::create_dir(&next).map_err(|_| {
                    err(
                        "TOOL_EXECUTION_FAILED",
                        format!("The folder {part} cannot be created."),
                    )
                })?;
            }
            Err(_) => {
                return Err(err(
                    "TOOL_EXECUTION_FAILED",
                    format!("{part} cannot be opened."),
                ))
            }
        }
        let real = fs::canonicalize(&next)
            .map_err(|_| err("TOOL_EXECUTION_FAILED", format!("{part} cannot be opened.")))?;
        if !real.starts_with(&root) {
            return Err(outside(rel));
        }
        dir = real;
    }
    let target = dir.join(name);
    if protected(&target) {
        return Err(outside(rel));
    }
    let created = match fs::symlink_metadata(&target) {
        Ok(meta) if is_link(&meta) => return Err(outside(rel)),
        Ok(meta) if meta.is_dir() => {
            return Err(err("TOOL_EXECUTION_FAILED", format!("{rel} is a folder.")))
        }
        Ok(_) => false,
        Err(e) if e.kind() == ErrorKind::NotFound => true,
        Err(_) => {
            return Err(err(
                "TOOL_EXECUTION_FAILED",
                format!("{rel} cannot be opened."),
            ))
        }
    };
    // write next to it, then swap in: a reader never sees half a file. The temp file is created
    // new: a link planted at its name is removed (the link itself, never its target), not followed
    let tmp = dir.join(format!(".{name}.realmnest-tmp"));
    if fs::symlink_metadata(&tmp).is_ok() {
        let _ = fs::remove_file(&tmp);
    }
    {
        use std::io::Write;
        let mut f = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&tmp)
            .map_err(|_| err("TOOL_EXECUTION_FAILED", format!("{rel} cannot be written.")))?;
        if f.write_all(bytes).is_err() {
            drop(f);
            let _ = fs::remove_file(&tmp);
            return Err(err(
                "TOOL_EXECUTION_FAILED",
                format!("{rel} cannot be written."),
            ));
        }
    }
    if let Err(_e) = fs::rename(&tmp, &target) {
        let _ = fs::remove_file(&tmp);
        return Err(err(
            "TOOL_EXECUTION_FAILED",
            format!("{rel} cannot be written."),
        ));
    }
    Ok(Written {
        path: shown(&root, &target),
        bytes: bytes.len() as u64,
        created,
    })
}

#[cfg(test)]
mod tests;
