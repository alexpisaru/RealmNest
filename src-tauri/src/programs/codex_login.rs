//! Signing in to a ChatGPT account from inside RealmNest: runs `codex login` (the CLI starts
//! its own sign-in page on localhost and opens the browser), reports the sign-in address and
//! ends when the CLI does. `codex logout` signs out. The CLI keeps the credentials in its own
//! folder (CODEX_HOME); RealmNest never sees the password or the tokens, and never reads that
//! folder's auth file. Only these two command lines are ever run, with at most CODEX_HOME set.

use super::claude_login::{LoginEvent, LoginSink};
use super::codex::{check_env, default_cwd, is_dropped_var, locate, HOME_ENV};
use crate::process::tree::Tree;
use std::collections::{BTreeMap, HashSet};
use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

/// a sign-in left open is ended after this
const LOGIN_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const LOGOUT_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Default)]
pub struct CodexLogin {
    /// running sign-ins, by id, with their process tree
    sessions: Arc<Mutex<std::collections::HashMap<String, Option<Arc<Tree>>>>>,
    counter: AtomicU64,
}

fn env_for(config_dir: Option<&str>) -> Result<BTreeMap<String, String>, String> {
    let mut env = BTreeMap::new();
    if let Some(d) = config_dir.map(str::trim).filter(|d| !d.is_empty()) {
        env.insert(HOME_ENV.to_string(), d.to_string());
    }
    check_env(&env)?;
    Ok(env)
}

fn command(args: &[&str], env: &BTreeMap<String, String>) -> Result<Command, String> {
    let resolved =
        locate(&|k| std::env::var(k).ok()).ok_or("Codex was not found on this computer")?;
    let cwd = default_cwd();
    let _ = std::fs::create_dir_all(&cwd);
    let mut cmd = Command::new(&resolved.command);
    cmd.args(&resolved.prefix_args)
        .args(args)
        .current_dir(cwd)
        .env_clear()
        .envs(
            std::env::vars_os()
                .filter_map(|(k, v)| Some((k.into_string().ok()?, v.into_string().ok()?)))
                .filter(|(k, _)| !is_dropped_var(k)),
        )
        .envs(env)
        .stdin(Stdio::null())
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

/// the sign-in address in the CLI's output: https on an OpenAI / ChatGPT host only
/// (never the CLI's own http://localhost callback)
pub fn find_login_url(text: &str) -> Option<String> {
    for word in text.split_whitespace() {
        let w = word.trim_matches(|c: char| {
            c == '"' || c == '\'' || c == '<' || c == '>' || c == ')' || c == '('
        });
        let Ok(u) = url::Url::parse(w) else { continue };
        let host = u.host_str().unwrap_or("");
        let ours = ["openai.com", "chatgpt.com"]
            .iter()
            .any(|d| host == *d || host.ends_with(&format!(".{d}")));
        if u.scheme() == "https" && ours && w.len() <= 4096 {
            return Some(w.to_string());
        }
    }
    None
}

/// a short, readable last line for the user (never the whole output, never an address)
fn last_line(text: &str) -> String {
    text.lines()
        .map(str::trim)
        .rfind(|l| {
            !l.is_empty()
                && !l.contains("http")
                && !l.starts_with("WARNING")
                && !l.to_lowercase().contains("browser")
        })
        .unwrap_or("")
        .chars()
        .take(200)
        .collect()
}

impl CodexLogin {
    pub fn start(
        &self,
        config_dir: Option<String>,
        sink: Arc<dyn LoginSink>,
    ) -> Result<String, String> {
        let env = env_for(config_dir.as_deref())?;
        let mut child = command(&["login"], &env)?
            .spawn()
            .map_err(|e| format!("Codex could not start ({e})"))?;
        let id = format!(
            "codex-login{}",
            self.counter.fetch_add(1, Ordering::Relaxed) + 1
        );
        let tree = Tree::adopt(&child).map(Arc::new);
        self.sessions
            .lock()
            .unwrap()
            .insert(id.clone(), tree.clone());
        let output = Arc::new(Mutex::new(String::new()));
        let sent = Arc::new(Mutex::new(HashSet::<String>::new()));
        let mut readers = Vec::new();
        for pipe in [
            Box::new(child.stdout.take().unwrap()) as Box<dyn Read + Send>,
            Box::new(child.stderr.take().unwrap()) as Box<dyn Read + Send>,
        ] {
            let output = output.clone();
            let sink = sink.clone();
            let sent = sent.clone();
            readers.push(thread::spawn(move || {
                let mut pipe = pipe;
                let mut buf = [0u8; 4096];
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
                            // only complete addresses: those followed by whitespace
                            let done = &all[..all.rfind(char::is_whitespace).unwrap_or(0)];
                            if let Some(url) = find_login_url(done) {
                                if sent.lock().unwrap().insert(url.clone()) {
                                    sink.send(LoginEvent::Url { url });
                                }
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
            let cancelled = sessions.lock().unwrap().remove(&sid).is_none();
            let text = output.lock().unwrap().clone();
            let ok = status.map(|s| s.success()).unwrap_or(false);
            let message = if ok {
                let l = last_line(&text);
                if l.is_empty() {
                    "Signed in.".to_string()
                } else {
                    l
                }
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

    pub fn cancel(&self, id: &str) -> bool {
        match self.sessions.lock().unwrap().remove(id) {
            Some(tree) => {
                if let Some(t) = tree {
                    t.kill();
                }
                true
            }
            None => false,
        }
    }

    pub fn cancel_all(&self) {
        let all: Vec<String> = self.sessions.lock().unwrap().keys().cloned().collect();
        for id in all {
            self.cancel(&id);
        }
    }
}

/// `codex logout` for this Codex folder
pub fn logout(config_dir: Option<String>) -> Result<(), String> {
    let env = env_for(config_dir.as_deref())?;
    let mut child = command(&["logout"], &env)?
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Codex could not start ({e})"))?;
    // its own kill-on-close job: nothing it starts outlives the sign-out (or RealmNest)
    let tree = Tree::adopt(&child);
    let deadline = Instant::now() + LOGOUT_TIMEOUT;
    loop {
        match child.try_wait() {
            Ok(Some(s)) if s.success() => return Ok(()),
            Ok(Some(_)) => return Err("Codex could not sign out.".into()),
            Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(100)),
            _ => {
                crate::process::tree::kill(tree.as_ref(), &mut child);
                return Err("Codex did not sign out in time.".into());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_only_openai_sign_in_pages() {
        let out = "Starting local login server on http://localhost:1455.\nIf your browser did not open, navigate to this URL to authenticate:\n\nhttps://auth.openai.com/oauth/authorize?response_type=code&client_id=x&state=y\n";
        assert_eq!(
            find_login_url(out).unwrap(),
            "https://auth.openai.com/oauth/authorize?response_type=code&client_id=x&state=y"
        );
        assert!(find_login_url("http://localhost:1455/auth/callback").is_none());
        assert!(find_login_url("visit: http://auth.openai.com/x").is_none());
        assert!(find_login_url("visit: https://evil.example/auth.openai.com").is_none());
        assert!(find_login_url("visit: https://openai.com.evil.example/").is_none());
        assert!(find_login_url("go to https://chatgpt.com/x").is_some());
    }

    #[test]
    fn last_line_skips_addresses_and_warnings() {
        assert_eq!(
            last_line("Starting local login server on http://localhost:1455.\nIf your browser did not open, navigate to this URL:\nhttps://auth.openai.com/x\nSuccessfully logged in\n"),
            "Successfully logged in"
        );
        assert_eq!(last_line("WARNING: proceeding\n"), "");
    }

    #[test]
    fn codex_folder_must_exist() {
        assert!(env_for(Some("relative/path")).is_err());
        assert!(env_for(Some("C:\\definitely\\not\\here\\realmnest")).is_err());
        assert!(env_for(None).unwrap().is_empty());
        assert!(env_for(Some("   ")).unwrap().is_empty());
        let dir = std::env::temp_dir().display().to_string();
        assert_eq!(env_for(Some(&dir)).unwrap().get(HOME_ENV), Some(&dir));
    }
}
