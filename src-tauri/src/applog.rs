//! RealmNest's own log file (docs/DIAGNOSTICS.md): what went wrong, where the user can find it and
//! send it. One line per entry: time (UTC), level, source, message. The page sends error codes and
//! short messages it has already redacted (never prompts, answers, file contents or secrets); this
//! side adds start and crash lines. `logs/realmnest.log` in the app's local data folder, rotated at
//! 1 MB with two older files kept (`realmnest.1.log`, `realmnest.2.log`).

use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

pub const MAX_BYTES: u64 = 1024 * 1024;
const KEEP: usize = 2;
pub const MESSAGE_MAX: usize = 2000;
const SOURCE_MAX: usize = 40;
/// what diagnostics read back: the newest part of the log
pub const READ_MAX: u64 = 512 * 1024;

pub struct AppLog {
    dir: Option<PathBuf>,
    file: Mutex<Option<File>>,
}

pub const LEVELS: [&str; 3] = ["info", "warn", "error"];

/// a source is a short name the page or this side gives (`chat`, `mcp`, `page`…)
pub fn valid_source(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= SOURCE_MAX
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
}

/// one line: control characters become spaces, at most MESSAGE_MAX characters
pub fn one_line(s: &str) -> String {
    let flat: String = s
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect();
    let trimmed = flat.trim();
    if trimmed.chars().count() > MESSAGE_MAX {
        trimmed.chars().take(MESSAGE_MAX - 1).collect::<String>() + "…"
    } else {
        trimmed.to_string()
    }
}

/// `2026-10-28T21:05:09.123Z` from milliseconds since 1970 (UTC; no time zone data needed)
pub fn iso_utc(ms: u64) -> String {
    let secs = ms / 1000;
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    // civil date from days since 1970-01-01 (Howard Hinnant's algorithm)
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}.{:03}Z",
        rem / 3600,
        rem % 3600 / 60,
        rem % 60,
        ms % 1000
    )
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

impl AppLog {
    pub fn new(dir: Option<PathBuf>) -> Self {
        Self {
            dir,
            file: Mutex::new(None),
        }
    }

    pub fn dir(&self) -> Option<&Path> {
        self.dir.as_deref()
    }

    fn path(dir: &Path, n: usize) -> PathBuf {
        if n == 0 {
            dir.join("realmnest.log")
        } else {
            dir.join(format!("realmnest.{n}.log"))
        }
    }

    /// Append one entry. A log that cannot be written never stops RealmNest: errors are dropped.
    pub fn write(&self, at_ms: u64, level: &str, source: &str, message: &str) {
        let Some(dir) = &self.dir else { return };
        let level = if LEVELS.contains(&level) {
            level
        } else {
            "info"
        };
        let source = if valid_source(source) { source } else { "app" };
        let line = format!(
            "{} {:<5} {}: {}\n",
            iso_utc(at_ms),
            level,
            source,
            one_line(message)
        );
        let Ok(mut guard) = self.file.lock() else {
            return;
        };
        // rotate when the file is full: .1 → .2, current → .1
        let full = guard
            .as_ref()
            .and_then(|f| f.metadata().ok())
            .is_some_and(|m| m.len() + line.len() as u64 > MAX_BYTES);
        if full {
            *guard = None;
            for n in (1..=KEEP).rev() {
                let from = Self::path(dir, n - 1);
                if from.exists() {
                    let _ = fs::rename(&from, Self::path(dir, n));
                }
            }
        }
        if guard.is_none() {
            let _ = fs::create_dir_all(dir);
            *guard = OpenOptions::new()
                .create(true)
                .append(true)
                .open(Self::path(dir, 0))
                .ok();
        }
        if let Some(f) = guard.as_mut() {
            let _ = f.write_all(line.as_bytes());
        }
    }

    /// The newest READ_MAX bytes of the log, older file first (for a diagnostics report).
    pub fn read(&self) -> String {
        let Some(dir) = &self.dir else {
            return String::new();
        };
        let _guard = self.file.lock();
        let mut left = READ_MAX;
        let mut parts: Vec<String> = Vec::new();
        for n in 0..=KEEP {
            if left == 0 {
                break;
            }
            let Ok(mut f) = File::open(Self::path(dir, n)) else {
                continue;
            };
            let len = f.metadata().map(|m| m.len()).unwrap_or(0);
            let take = len.min(left);
            if f.seek(SeekFrom::Start(len - take)).is_err() {
                continue;
            }
            let mut buf = Vec::with_capacity(take as usize);
            if f.take(take).read_to_end(&mut buf).is_err() {
                continue;
            }
            let mut text = String::from_utf8_lossy(&buf).into_owned();
            // a cut at the start: drop the partial first line
            if take < len {
                if let Some(i) = text.find('\n') {
                    text = text[i + 1..].to_string();
                }
            }
            left -= take;
            parts.push(text);
        }
        parts.reverse();
        parts.concat()
    }
}

/// Native crashes (a panic in a command or a background task) are written to the log too.
pub fn log_panics(log: std::sync::Arc<AppLog>) {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let place = info
            .location()
            .map(|l| format!(" at {}:{}", l.file(), l.line()))
            .unwrap_or_default();
        let what = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "panic".into());
        log.write(now_ms(), "error", "native", &format!("{what}{place}"));
        previous(info);
    }));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("realmnest-log-{name}-{}", now_ms()));
        let _ = fs::remove_dir_all(&d);
        d
    }

    #[test]
    fn dates_are_utc_iso() {
        assert_eq!(iso_utc(0), "1970-01-01T00:00:00.000Z");
        assert_eq!(iso_utc(1_793_226_141_815), "2026-10-28T22:22:21.815Z");
        assert_eq!(iso_utc(951_782_400_000), "2000-02-29T00:00:00.000Z");
    }

    #[test]
    fn lines_are_one_line_short_and_well_formed() {
        let dir = tmp("lines");
        let log = AppLog::new(Some(dir.clone()));
        log.write(0, "error", "chat", "first\nsecond\u{0}");
        log.write(0, "loud", "bad source!", &"x".repeat(5000));
        let text = log.read();
        let lines: Vec<&str> = text.lines().collect();
        assert_eq!(
            lines[0],
            "1970-01-01T00:00:00.000Z error chat: first second"
        );
        assert!(lines[1].starts_with("1970-01-01T00:00:00.000Z info  app: xxx"));
        assert_eq!(
            lines[1].chars().count(),
            "1970-01-01T00:00:00.000Z info  app: ".len() + MESSAGE_MAX
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rotates_at_the_limit_and_keeps_two_old_files() {
        let dir = tmp("rotate");
        let log = AppLog::new(Some(dir.clone()));
        let big = "y".repeat(1900);
        for _ in 0..(3 * MAX_BYTES as usize / 1900 + 600) {
            log.write(0, "info", "t", &big);
        }
        assert!(AppLog::path(&dir, 0).exists());
        assert!(AppLog::path(&dir, 1).exists());
        assert!(AppLog::path(&dir, 2).exists());
        assert!(!dir.join("realmnest.3.log").exists());
        for n in 0..=KEEP {
            assert!(fs::metadata(AppLog::path(&dir, n)).unwrap().len() <= MAX_BYTES);
        }
        // reading gives at most READ_MAX bytes, whole lines only
        let text = log.read();
        assert!(text.len() as u64 <= READ_MAX);
        assert!(text.lines().all(|l| l.starts_with("1970-")));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn no_folder_no_log() {
        let log = AppLog::new(None);
        log.write(0, "error", "x", "y");
        assert_eq!(log.read(), "");
    }
}
