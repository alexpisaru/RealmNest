//! Signing in to a Claude account from inside RealmNest: runs `claude auth login --claudeai`
//! (the CLI opens the browser), reports the sign-in address, passes on the code the user
//! pastes, and ends when the CLI does. `claude auth logout` signs out. The CLI keeps the
//! credentials in its own config folder; RealmNest never sees the password or the tokens.
//! Only these two command lines are ever run, with at most CLAUDE_CONFIG_DIR set.

use super::claude::{check_env, is_session_var, locate, Claude, CONFIG_ENV};
use super::HostProgram;
use crate::process::tree::Tree;
use serde::Serialize;
use std::collections::{BTreeMap, HashMap};
use std::io::{Read, Write};
use std::process::{ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

/// a sign-in left open is ended after this
const LOGIN_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const LOGOUT_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "t", rename_all = "lowercase")]
pub enum LoginEvent {
    /// the sign-in page (the CLI also tries to open it in the browser)
    Url { url: String },
    /// the CLI waits for the code shown after signing in
    Prompt,
    /// finished: signed in (ok) or not, with the CLI's last words
    End { ok: bool, message: String },
}

pub trait LoginSink: Send + Sync + 'static {
    fn send(&self, e: LoginEvent);
}

impl LoginSink for tauri::ipc::Channel<LoginEvent> {
    fn send(&self, e: LoginEvent) {
        let _ = tauri::ipc::Channel::send(self, e);
    }
}

struct Session {
    stdin: Option<ChildStdin>,
    tree: Option<Arc<Tree>>,
}

#[derive(Default)]
pub struct ClaudeLogin {
    sessions: Arc<Mutex<HashMap<String, Session>>>,
    counter: AtomicU64,
}

fn env_for(config_dir: Option<&str>) -> Result<BTreeMap<String, String>, String> {
    let mut env = BTreeMap::new();
    if let Some(d) = config_dir.map(str::trim).filter(|d| !d.is_empty()) {
        env.insert(CONFIG_ENV.to_string(), d.to_string());
    }
    check_env(&env)?;
    Ok(env)
}

fn command(args: &[&str], env: &BTreeMap<String, String>) -> Result<Command, String> {
    let resolved =
        locate(&|k| std::env::var(k).ok()).ok_or("Claude Code was not found on this computer")?;
    let cwd = Claude.default_cwd();
    let _ = std::fs::create_dir_all(&cwd);
    let mut cmd = Command::new(&resolved.command);
    cmd.args(&resolved.prefix_args)
        .args(args)
        .current_dir(cwd)
        .env_clear()
        .envs(
            std::env::vars_os()
                .filter_map(|(k, v)| Some((k.into_string().ok()?, v.into_string().ok()?)))
                .filter(|(k, _)| !is_session_var(k)),
        )
        .envs(env)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    Ok(cmd)
}

/// the sign-in address in the CLI's output: https on an Anthropic / Claude host only
pub fn find_login_url(text: &str) -> Option<String> {
    for word in text.split_whitespace() {
        let w = word.trim_matches(|c: char| {
            c == '"' || c == '\'' || c == '<' || c == '>' || c == ')' || c == '('
        });
        let Ok(u) = url::Url::parse(w) else { continue };
        let host = u.host_str().unwrap_or("");
        let ours = ["claude.com", "claude.ai", "anthropic.com"]
            .iter()
            .any(|d| host == *d || host.ends_with(&format!(".{d}")));
        if u.scheme() == "https" && ours && w.len() <= 2048 {
            return Some(w.to_string());
        }
    }
    None
}

/// the code page shows something like `abc…#state`: letters, digits and a few separators
pub fn is_login_code(code: &str) -> bool {
    let c = code.trim();
    !c.is_empty()
        && c.len() <= 512
        && c.chars()
            .all(|ch| ch.is_ascii_alphanumeric() || "-_.~#=+/".contains(ch))
}

/// a short, readable last line for the user (never the whole output)
fn last_line(text: &str) -> String {
    text.lines()
        .map(str::trim)
        .rfind(|l| {
            !l.is_empty()
                && !l.starts_with("If the browser")
                && !l.starts_with("Paste code")
                && !l.contains("http")
        })
        .unwrap_or("")
        .chars()
        .take(200)
        .collect()
}

impl ClaudeLogin {
    pub fn start(
        &self,
        config_dir: Option<String>,
        sink: Arc<dyn LoginSink>,
    ) -> Result<String, String> {
        let env = env_for(config_dir.as_deref())?;
        let mut child = command(&["auth", "login", "--claudeai"], &env)?
            .spawn()
            .map_err(|e| format!("Claude Code could not start ({e})"))?;
        let id = format!("login{}", self.counter.fetch_add(1, Ordering::Relaxed) + 1);
        let tree = Tree::adopt(&child).map(Arc::new);
        self.sessions.lock().unwrap().insert(
            id.clone(),
            Session {
                stdin: child.stdin.take(),
                tree: tree.clone(),
            },
        );
        // both pipes: chunks, not lines (the code prompt has no newline)
        let output = Arc::new(Mutex::new(String::new()));
        let mut readers = Vec::new();
        for pipe in [
            Box::new(child.stdout.take().unwrap()) as Box<dyn Read + Send>,
            Box::new(child.stderr.take().unwrap()) as Box<dyn Read + Send>,
        ] {
            let output = output.clone();
            let sink = sink.clone();
            readers.push(thread::spawn(move || {
                let mut pipe = pipe;
                let mut buf = [0u8; 4096];
                let (mut sent_url, mut sent_prompt) = (false, false);
                loop {
                    match pipe.read(&mut buf) {
                        Ok(0) | Err(_) => break,
                        Ok(n) => {
                            let all = {
                                let mut o = output.lock().unwrap();
                                if o.len() < 64 * 1024 {
                                    o.push_str(&String::from_utf8_lossy(&buf[..n]));
                                }
                                o.clone()
                            };
                            if !sent_url {
                                if let Some(url) = find_login_url(&all) {
                                    sent_url = true;
                                    sink.send(LoginEvent::Url { url });
                                }
                            }
                            if !sent_prompt && all.to_lowercase().contains("paste code") {
                                sent_prompt = true;
                                sink.send(LoginEvent::Prompt);
                            }
                        }
                    }
                }
            }));
        }
        let sessions = self.sessions.clone();
        let sid = id.clone();
        thread::spawn(move || {
            let deadline = Instant::now() + LOGIN_TIMEOUT;
            let status = loop {
                match child.try_wait() {
                    Ok(Some(s)) => break Some(s),
                    Ok(None) => {}
                    Err(_) => break None,
                }
                // cancelled: the session was removed
                let gone = !sessions.lock().unwrap().contains_key(&sid);
                if gone || Instant::now() >= deadline {
                    match &tree {
                        Some(t) => t.kill(),
                        None => {
                            let _ = child.kill();
                        }
                    }
                    let _ = child.wait();
                    break None;
                }
                thread::sleep(Duration::from_millis(150));
            };
            for r in readers {
                let _ = r.join();
            }
            // removed already: cancelled by the user (cancel() kills the CLI)
            let cancelled = sessions.lock().unwrap().remove(&sid).is_none();
            let text = output.lock().unwrap().clone();
            let ok = status.map(|s| s.success()).unwrap_or(false);
            let message = if ok {
                last_line(&text)
            } else if status.is_none() || cancelled {
                "The sign-in was stopped.".to_string()
            } else {
                let l = last_line(&text);
                if l.is_empty() {
                    "The sign-in did not complete.".to_string()
                } else {
                    l
                }
            };
            sink.send(LoginEvent::End { ok, message });
        });
        Ok(id)
    }

    /// the code from the browser, typed into the waiting CLI
    pub fn code(&self, id: &str, code: &str) -> Result<(), String> {
        if !is_login_code(code) {
            return Err("That does not look like a sign-in code.".into());
        }
        let mut sessions = self.sessions.lock().unwrap();
        let s = sessions
            .get_mut(id)
            .ok_or("This sign-in has already ended.")?;
        let stdin = s
            .stdin
            .as_mut()
            .ok_or("This sign-in no longer accepts a code.")?;
        stdin
            .write_all(format!("{}\n", code.trim()).as_bytes())
            .and_then(|_| stdin.flush())
            .map_err(|e| format!("The code could not be passed on ({e})"))
    }

    pub fn cancel(&self, id: &str) -> bool {
        let s = self.sessions.lock().unwrap().remove(id);
        if let Some(s) = &s {
            if let Some(t) = &s.tree {
                t.kill();
            }
        }
        s.is_some()
    }

    pub fn cancel_all(&self) {
        let all: Vec<String> = self.sessions.lock().unwrap().keys().cloned().collect();
        for id in all {
            self.cancel(&id);
        }
    }
}

/// `claude auth logout` for this config folder
pub fn logout(config_dir: Option<String>) -> Result<(), String> {
    let env = env_for(config_dir.as_deref())?;
    let mut child = command(&["auth", "logout"], &env)?
        .spawn()
        .map_err(|e| format!("Claude Code could not start ({e})"))?;
    drop(child.stdin.take());
    // its own kill-on-close job: nothing it starts outlives the sign-out (or RealmNest)
    let tree = Tree::adopt(&child);
    let deadline = Instant::now() + LOGOUT_TIMEOUT;
    loop {
        match child.try_wait() {
            Ok(Some(s)) if s.success() => return Ok(()),
            Ok(Some(_)) => return Err("Claude Code could not sign out.".into()),
            Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(100)),
            _ => {
                crate::process::tree::kill(tree.as_ref(), &mut child);
                return Err("Claude Code did not sign out in time.".into());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_only_anthropic_sign_in_pages() {
        let out = "Opening browser to sign in…\nIf the browser didn't open, visit: https://claude.com/cai/oauth/authorize?code=true&client_id=x&state=y\nPaste code here if prompted >";
        assert_eq!(
            find_login_url(out).unwrap(),
            "https://claude.com/cai/oauth/authorize?code=true&client_id=x&state=y"
        );
        assert!(find_login_url("visit: https://evil.example/claude.com/login").is_none());
        assert!(find_login_url("visit: http://claude.com/login").is_none());
        assert!(find_login_url("visit: https://claude.com.evil.example/").is_none());
        assert_eq!(
            find_login_url("go to https://console.anthropic.com/x").unwrap(),
            "https://console.anthropic.com/x"
        );
    }

    #[test]
    fn codes_are_plain_tokens() {
        assert!(is_login_code("AbC-123_x.y~z#STATE_9"));
        assert!(!is_login_code(""));
        assert!(!is_login_code("code; rm -rf /"));
        assert!(!is_login_code("a\nb"));
        assert!(!is_login_code(&"a".repeat(600)));
    }

    #[test]
    fn last_line_skips_addresses() {
        assert_eq!(
            last_line(
                "Opening…\nIf the browser didn't open, visit: https://x\nLogin successful.\n"
            ),
            "Login successful."
        );
    }

    #[test]
    fn config_folder_must_exist() {
        assert!(env_for(Some("relative/path")).is_err());
        assert!(env_for(Some("C:\\definitely\\not\\here\\realmnest")).is_err());
        assert!(env_for(None).unwrap().is_empty());
        assert!(env_for(Some("   ")).unwrap().is_empty());
    }
}
