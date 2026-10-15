//! A file's type from its first bytes (magic numbers), never from its name alone.

/// The MIME type the content shows, or None (plain text, or nothing recognisable).
pub fn mime(b: &[u8]) -> Option<&'static str> {
    let starts = |m: &[u8]| b.starts_with(m);
    let at = |i: usize, m: &[u8]| b.len() >= i + m.len() && &b[i..i + m.len()] == m;
    Some(if starts(b"\x89PNG\r\n\x1a\n") {
        "image/png"
    } else if starts(b"\xff\xd8\xff") {
        "image/jpeg"
    } else if starts(b"GIF87a") || starts(b"GIF89a") {
        "image/gif"
    } else if starts(b"RIFF") && at(8, b"WEBP") {
        "image/webp"
    } else if starts(b"RIFF") && at(8, b"WAVE") {
        "audio/wav"
    } else if starts(b"%PDF-") {
        "application/pdf"
    } else if starts(b"PK\x03\x04") {
        "application/zip"
    } else if starts(b"\x1f\x8b") {
        "application/gzip"
    } else if starts(b"ID3") {
        "audio/mpeg"
    } else if starts(b"OggS") {
        "audio/ogg"
    } else if starts(b"fLaC") {
        "audio/flac"
    } else if at(4, b"ftyp") {
        "video/mp4"
    } else if starts(b"\x1a\x45\xdf\xa3") {
        "video/webm"
    } else if starts(b"MZ") {
        "application/x-msdownload"
    } else if starts(b"\x7fELF") {
        "application/x-elf"
    } else if starts(b"SQLite format 3\0") {
        "application/vnd.sqlite3"
    } else {
        // text that is really markup: SVG and HTML are recognised so they are never rendered
        let head = String::from_utf8_lossy(&b[..b.len().min(512)]).to_ascii_lowercase();
        let head = head.trim_start_matches('\u{feff}').trim_start();
        if head.starts_with("<svg") || (head.starts_with("<?xml") && head.contains("<svg")) {
            "image/svg+xml"
        } else if head.starts_with("<!doctype html") || head.starts_with("<html") {
            "text/html"
        } else {
            return None;
        }
    })
}
