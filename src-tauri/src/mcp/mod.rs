//! MCP servers over stdio: the native transport. The page decides nothing
//! about processes; it asks to start a configured server and Rust checks the
//! request itself:
//!
//! - one executable (an absolute path, or a bare name found on PATH) plus argv;
//!   no shell, and on Windows only `.exe` (a `.cmd`/`.bat` would run through cmd.exe);
//! - a working folder that exists, variables with valid names, secret
//!   variables read from the credential store under `mcp.<server id>.<VAR>` only
//!   (so a page can never pour another secret, e.g. an API key, into a process);
//! - **the user's consent**, given natively: the first time a launch (program,
//!   arguments, folder, variables) is seen, a Windows dialog asks, and only a
//!   "Yes" adds it to a trust file the page cannot write. A compromised page
//!   therefore cannot start an arbitrary program on its own.
//!
//! The server runs in its own kill-on-close Job Object (its whole tree dies
//! with it, and with RealmNest). stdout is read line by line (one JSON-RPC message
//! per line, size-capped, secrets redacted) and handed to the page; stderr is
//! forwarded for Debug. Writes are JSON-RPC objects serialized on one line, queued to a
//! writer thread per server: a server that stops reading never blocks the caller for
//! more than SEND_TIMEOUT. The protocol itself (handshake, tools) lives in the page's McpClient.

pub mod bridge;
pub mod http;
pub mod oauth;
#[cfg(test)]
mod tests;

use crate::process::tree::Tree;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{sync_channel, SyncSender, TrySendError};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;
use std::time::{Duration, Instant};

const MAX_ARGS: usize = 64;
const MAX_ARG_LEN: usize = 4096;
const MAX_ENV: usize = 64;
const MAX_ENV_VALUE: usize = 8192;
const MAX_PATH_LEN: usize = 1024;
/// one message from a server (an image preview in base64 fits)
pub const MAX_LINE_BYTES: usize = 16 * 1024 * 1024;
/// one message to a server
pub const MAX_SEND_BYTES: usize = 8 * 1024 * 1024;
const MAX_STDERR_LINE: usize = 2000;
const MAX_RUNNING: usize = 32;
const MAX_TRUSTED: usize = 200;
const STOP_GRACE: Duration = Duration::from_millis(2000);
const POLL: Duration = Duration::from_millis(25);
/// messages waiting for a server's input (each at most MAX_SEND_BYTES)
const SEND_QUEUE: usize = 8;
/// how long a send waits for room in that queue before saying the server is stuck
pub const SEND_TIMEOUT: Duration = Duration::from_secs(10);
/// the consent dialog must fit on screen: longer launches are refused, never cut
const MAX_CONSENT_CHARS: usize = 5000;
const MAX_CONSENT_LINES: usize = 80;

/// A poisoned lock (a panic elsewhere) must not take shutdown and every later call down with it.
pub(crate) fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

/// What the page asks to start.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Launch {
    pub server_id: String,
    pub command: String,
    pub args: Vec<String>,
    pub cwd: Option<String>,
    #[serde(default)]
    pub env: BTreeMap<String, String>,
    /// variable → credential-store name (`mcp.<server id>.<VAR>`)
    #[serde(default)]
    pub secret_env: BTreeMap<String, String>,
}

/// Everything the page hears about a server, in order; always ends with one `exit`.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "t", rename_all = "snake_case")]
pub enum McpEvent {
    Started {
        pid: u32,
        executable: String,
    },
    Message {
        message: Value,
        bytes: usize,
    },
    Invalid {
        reason: String,
        bytes: usize,
    },
    Stderr {
        line: String,
    },
    Exit {
        reason: &'static str,
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        message: Option<String>,
    },
}

impl McpEvent {
    fn exit(reason: &'static str, message: impl Into<String>) -> Self {
        McpEvent::Exit {
            reason,
            code: None,
            message: Some(message.into()),
        }
    }
}

/// Where a server's events go (a Tauri channel in the app, a collector in tests).
pub trait McpSink: Send + Sync + 'static {
    fn send(&self, e: McpEvent);
}

impl McpSink for tauri::ipc::Channel<McpEvent> {
    fn send(&self, e: McpEvent) {
        let _ = tauri::ipc::Channel::send(self, e);
    }
}

/// Asks the user whether a launch may run (a native dialog in the app).
pub trait Confirm: Send + Sync + 'static {
    fn confirm(&self, launch: &Prepared) -> bool;
}

/// Reads secret values (the OS credential store in the app).
pub trait Secrets: Send + Sync + 'static {
    fn read(&self, name: &str) -> Result<Option<String>, String>;
    /// Rust-side records next to a secret (e.g. the address a header secret belongs to)
    fn write(&self, name: &str, value: &str) -> Result<(), String>;
}

pub struct KeyringSecrets;
impl Secrets for KeyringSecrets {
    fn read(&self, name: &str) -> Result<Option<String>, String> {
        crate::secrets::read(name)
    }
    fn write(&self, name: &str, value: &str) -> Result<(), String> {
        crate::secrets::set(name, value)
    }
}

/// A launch after every check: what will really run.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Prepared {
    pub executable: PathBuf,
    pub args: Vec<String>,
    pub cwd: PathBuf,
    pub env: BTreeMap<String, String>,
    /// names only (values never leave the credential store except into the process)
    pub secret_names: Vec<String>,
}

impl Prepared {
    /// what the user approves: everything that decides what runs, except secret values
    fn fingerprint(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }
}

#[derive(Debug, PartialEq)]
pub struct Refusal {
    pub reason: &'static str,
    pub message: String,
}

fn refuse(reason: &'static str, message: impl Into<String>) -> Refusal {
    Refusal {
        reason,
        message: message.into(),
    }
}

pub(crate) fn is_server_id(v: &str) -> bool {
    !v.is_empty()
        && v.len() <= 64
        && v.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

pub fn is_env_name(v: &str) -> bool {
    let mut bytes = v.bytes();
    matches!(bytes.next(), Some(b) if b.is_ascii_alphabetic() || b == b'_')
        && v.len() <= 128
        && bytes.all(|b| b.is_ascii_alphanumeric() || b == b'_')
}

fn single_line(v: &str) -> bool {
    !v.chars().any(|c| c == '\0' || c == '\n' || c == '\r')
}

/// The executable: an absolute path to a file, or a bare name looked up on PATH.
/// Windows: `.exe` only.
pub fn resolve_executable(command: &str) -> Result<PathBuf, Refusal> {
    let command = command.trim();
    if command.is_empty() || command.len() > MAX_PATH_LEN || !single_line(command) {
        return Err(refuse(
            "refused",
            "the executable is not a valid path or name",
        ));
    }
    let has_sep = command.contains('/') || command.contains('\\');
    let found = if has_sep {
        let p = PathBuf::from(command);
        if !p.is_absolute() {
            return Err(refuse(
                "refused",
                "use an absolute path to the executable, or just its name",
            ));
        }
        p.is_file().then_some(p)
    } else {
        find_on_path(command)
    };
    let path = found.ok_or_else(|| refuse("not_found", format!("{command} was not found")))?;
    let path = dunce_canonical(&path)
        .ok_or_else(|| refuse("not_found", format!("{command} was not found")))?;
    if cfg!(windows) {
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if ext != "exe" {
            return Err(refuse(
                "refused",
                "only .exe programs can be started (scripts such as .cmd, .bat or .ps1 would run through a shell)",
            ));
        }
    }
    Ok(path)
}

/// canonical path without the `\\?\` prefix (what users recognise)
fn dunce_canonical(p: &Path) -> Option<PathBuf> {
    let c = std::fs::canonicalize(p).ok()?;
    let s = c.to_string_lossy();
    if let Some(rest) = s.strip_prefix(r"\\?\") {
        if !rest.starts_with("UNC\\") {
            return Some(PathBuf::from(rest));
        }
    }
    Some(c)
}

fn find_on_path(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    let with_ext = if cfg!(windows) && Path::new(name).extension().is_none() {
        format!("{name}.exe")
    } else {
        name.to_string()
    };
    std::env::split_paths(&path)
        .filter(|d| d.is_absolute())
        .map(|d| d.join(&with_ext))
        .find(|p| p.is_file())
}

/// Every check that can refuse a launch before anything runs.
pub fn prepare(l: &Launch) -> Result<Prepared, Refusal> {
    if !is_server_id(&l.server_id) {
        return Err(refuse("refused", "invalid server id"));
    }
    let executable = resolve_executable(&l.command)?;
    if l.args.len() > MAX_ARGS {
        return Err(refuse("refused", "too many arguments"));
    }
    if l.args
        .iter()
        .any(|a| a.len() > MAX_ARG_LEN || !single_line(a))
    {
        return Err(refuse(
            "refused",
            "arguments must be single lines of at most 4096 characters",
        ));
    }
    let cwd = match l.cwd.as_deref().map(str::trim).filter(|c| !c.is_empty()) {
        Some(c) => {
            let p = PathBuf::from(c);
            if c.len() > MAX_PATH_LEN || !p.is_absolute() || !p.is_dir() {
                return Err(refuse(
                    "refused",
                    "the working folder must be an existing absolute folder",
                ));
            }
            dunce_canonical(&p).unwrap_or(p)
        }
        None => executable
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| refuse("refused", "no working folder"))?,
    };
    if l.env.len() + l.secret_env.len() > MAX_ENV {
        return Err(refuse("refused", "too many environment variables"));
    }
    for (k, v) in &l.env {
        if !is_env_name(k) || v.len() > MAX_ENV_VALUE || v.contains('\0') {
            return Err(refuse(
                "refused",
                format!("environment variable {} is not valid", short(k)),
            ));
        }
    }
    let mut secret_names = Vec::new();
    for (k, r) in &l.secret_env {
        // only this server's own secrets: never another connection's key
        if !is_env_name(k) || l.env.contains_key(k) || *r != format!("mcp.{}.{k}", l.server_id) {
            return Err(refuse(
                "refused",
                format!("secret variable {} is not valid", short(k)),
            ));
        }
        // a hidden value cannot be reviewed: variables that change what code runs are never secret
        if is_risky_env(k) {
            return Err(refuse(
                "refused",
                format!(
                    "{} changes which code the program runs: it cannot be a secret variable",
                    short(k)
                ),
            ));
        }
        secret_names.push(k.clone());
    }
    Ok(Prepared {
        executable,
        args: l.args.clone(),
        cwd,
        env: l.env.clone(),
        secret_names,
    })
}

fn short(s: &str) -> String {
    s.chars().take(40).collect()
}

/// Variables that change which code a program loads or where it finds programs.
pub fn is_risky_env(name: &str) -> bool {
    const RISKY: [&str; 15] = [
        "NODE_OPTIONS",
        "NODE_PATH",
        "PATH",
        "PATHEXT",
        "PYTHONPATH",
        "PYTHONSTARTUP",
        "PYTHONHOME",
        "PERL5OPT",
        "PERL5LIB",
        "RUBYOPT",
        "RUBYLIB",
        "COMSPEC",
        "JAVA_TOOL_OPTIONS",
        "_JAVA_OPTIONS",
        "ELECTRON_RUN_AS_NODE",
    ];
    // Windows variable names ignore case
    let n = name.to_ascii_uppercase();
    RISKY.contains(&n.as_str()) || n.starts_with("LD_") || n.starts_with("DYLD_")
}

/// Control and direction-changing characters made visible, so text reads as it really is.
pub fn escape_visible(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        let hidden = c.is_control()
            || matches!(c, '\u{202A}'..='\u{202E}' | '\u{2066}'..='\u{2069}')
            || matches!(c, '\u{200B}'..='\u{200F}' | '\u{061C}' | '\u{FEFF}');
        if hidden {
            out.push_str(&format!("\\u{{{:04X}}}", c as u32));
        } else {
            out.push(c);
        }
    }
    out
}

/// A plain variable whose value is probably a credential (shown masked in the dialog).
fn looks_secret(name: &str, value: &str) -> bool {
    let n = name.to_ascii_uppercase();
    let by_name = [
        "TOKEN",
        "SECRET",
        "PASSWORD",
        "PASSWD",
        "API_KEY",
        "APIKEY",
        "ACCESS_KEY",
        "PRIVATE_KEY",
        "CREDENTIAL",
        "AUTH",
    ]
    .iter()
    .any(|w| n.contains(w))
        || n == "KEY"
        || n.ends_with("_KEY");
    let v = value.trim();
    let by_prefix = [
        "sk-",
        "ghp_",
        "gho_",
        "github_pat_",
        "glpat-",
        "xoxb-",
        "xoxp-",
        "AKIA",
        "AIza",
        "eyJ",
    ]
    .iter()
    .any(|p| v.starts_with(p));
    // long, no spaces, paths or addresses, letters and digits mixed: a token
    let by_shape = v.len() >= 32
        && v.chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '+' | '='))
        && v.chars().any(|c| c.is_ascii_digit())
        && v.chars().any(|c| c.is_ascii_alphabetic());
    by_name || by_prefix || by_shape
}

/// What the consent dialog says: program, every argument in full, folder, variables with
/// their values (credentials masked), and a warning for variables that change what runs.
/// A launch too long to show on one screen is refused rather than shown in part.
pub fn consent_text(p: &Prepared) -> Result<String, Refusal> {
    let args = if p.args.is_empty() {
        "(nessuno)".to_string()
    } else {
        p.args
            .iter()
            .map(|a| format!("«{}»", escape_visible(a)))
            .collect::<Vec<_>>()
            .join(" ")
    };
    let mut vars: Vec<String> = Vec::new();
    let mut risky: Vec<&str> = Vec::new();
    for (k, v) in &p.env {
        if is_risky_env(k) {
            risky.push(k);
            vars.push(format!("{k} = {}", escape_visible(v)));
        } else if looks_secret(k, v) {
            vars.push(format!(
                "{k} = •••••• (nascosto, {} caratteri)",
                v.chars().count()
            ));
        } else {
            vars.push(format!("{k} = {}", escape_visible(v)));
        }
    }
    for n in &p.secret_names {
        vars.push(format!("{n} = (segreto dal portachiavi, nascosto)"));
    }
    let warning = if risky.is_empty() {
        String::new()
    } else {
        format!(
            "ATTENZIONE: {} cambia quale codice esegue il programma. \
             Consenti solo se hai impostato tu questo valore.\n\n",
            risky.join(", ")
        )
    };
    let text = format!(
        "RealmNest vuole avviare un server MCP.\n\n\
         Programma:\n{}\n\nArgomenti:\n{}\n\nCartella:\n{}\n\nVariabili:\n{}\n\n{warning}\
         Un server MCP è un programma che gira sul tuo computer con i tuoi permessi: \
         RealmNest decide quali suoi strumenti chiamare, ma non può limitare ciò che il programma fa. \
         Avvialo solo se ti fidi.\n\n\
         Consentire? (RealmNest lo ricorderà per questa configurazione.)",
        escape_visible(&p.executable.to_string_lossy()),
        args,
        escape_visible(&p.cwd.to_string_lossy()),
        if vars.is_empty() {
            "nessuna".to_string()
        } else {
            vars.join("\n")
        }
    );
    if text.chars().count() > MAX_CONSENT_CHARS || text.lines().count() > MAX_CONSENT_LINES {
        return Err(refuse(
            "refused",
            "this configuration is too long to show for approval: shorten its arguments or variables",
        ));
    }
    Ok(text)
}

/// Launches the user approved, in a file only Rust writes.
pub struct TrustStore {
    path: Option<PathBuf>,
    entries: Vec<String>,
}

impl TrustStore {
    pub fn load(path: Option<PathBuf>) -> Self {
        let entries = path
            .as_ref()
            .and_then(|p| std::fs::read_to_string(p).ok())
            .and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
            .unwrap_or_default();
        TrustStore { path, entries }
    }
    fn trusts(&self, p: &Prepared) -> bool {
        self.entries.contains(&p.fingerprint())
    }
    fn add(&mut self, p: &Prepared) {
        let f = p.fingerprint();
        self.entries.retain(|e| *e != f);
        self.entries.push(f);
        if self.entries.len() > MAX_TRUSTED {
            let extra = self.entries.len() - MAX_TRUSTED;
            self.entries.drain(0..extra);
        }
        if let Some(path) = &self.path {
            if let Some(dir) = path.parent() {
                let _ = std::fs::create_dir_all(dir);
            }
            if let Ok(s) = serde_json::to_string_pretty(&self.entries) {
                let _ = std::fs::write(path, s);
            }
        }
    }
}

struct Server {
    /// the queue to the writer thread; dropping it closes the server's input
    input: Mutex<Option<SyncSender<Vec<u8>>>>,
    child: Arc<Mutex<Child>>,
    tree: Option<Arc<Tree>>,
    stopping: AtomicBool,
    killed: AtomicBool,
}

/// The running MCP servers, by server id.
pub struct McpHost {
    servers: Arc<Mutex<HashMap<String, Arc<Server>>>>,
    trust: Mutex<TrustStore>,
    confirm: Arc<dyn Confirm>,
    secrets: Arc<dyn Secrets>,
}

impl McpHost {
    pub fn new(trust: TrustStore, confirm: Arc<dyn Confirm>, secrets: Arc<dyn Secrets>) -> Self {
        McpHost {
            servers: Arc::new(Mutex::new(HashMap::new())),
            trust: Mutex::new(trust),
            confirm,
            secrets,
        }
    }

    pub fn running(&self) -> Vec<String> {
        let mut ids: Vec<String> = lock(&self.servers).keys().cloned().collect();
        ids.sort();
        ids
    }

    /// Start a server. Blocks while the user answers the consent dialog.
    /// Every outcome, including a refusal, is reported on `sink`.
    pub fn start(&self, launch: Launch, sink: Arc<dyn McpSink>) {
        if lock(&self.servers).contains_key(&launch.server_id) {
            return sink.send(McpEvent::exit("refused", "this server is already running"));
        }
        if lock(&self.servers).len() >= MAX_RUNNING {
            return sink.send(McpEvent::exit(
                "refused",
                "too many MCP servers are running",
            ));
        }
        let prepared = match prepare(&launch) {
            Ok(p) => p,
            Err(r) => return sink.send(McpEvent::exit(r.reason, r.message)),
        };
        // secrets: read now, used for the process and for redaction
        let mut secret_values = Vec::new();
        for (k, r) in &launch.secret_env {
            match self.secrets.read(r) {
                Ok(Some(v)) => secret_values.push((k.clone(), v)),
                Ok(None) => {
                    return sink.send(McpEvent::exit(
                        "missing_secret",
                        format!("the secret variable {k} has no value"),
                    ))
                }
                Err(e) => return sink.send(McpEvent::exit("refused", e)),
            }
        }
        let trusted = lock(&self.trust).trusts(&prepared);
        if !trusted {
            // what the user would be asked must fit the dialog whole
            if let Err(r) = consent_text(&prepared) {
                return sink.send(McpEvent::exit(r.reason, r.message));
            }
            if !self.confirm.confirm(&prepared) {
                return sink.send(McpEvent::exit(
                    "declined",
                    "starting this server was not allowed",
                ));
            }
            lock(&self.trust).add(&prepared);
        }
        self.spawn(&launch.server_id, &prepared, secret_values, sink);
    }

    fn spawn(
        &self,
        id: &str,
        p: &Prepared,
        secrets: Vec<(String, String)>,
        sink: Arc<dyn McpSink>,
    ) {
        let mut cmd = Command::new(&p.executable);
        cmd.args(&p.args)
            .current_dir(&p.cwd)
            .envs(&p.env)
            .envs(secrets.iter().map(|(k, v)| (k, v)))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let reason = if e.kind() == std::io::ErrorKind::NotFound {
                    "not_found"
                } else {
                    "refused"
                };
                return sink.send(McpEvent::exit(reason, format!("could not start: {e}")));
            }
        };
        let tree = Tree::adopt(&child).map(Arc::new);
        let pid = child.id();
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let server = Arc::new(Server {
            input: Mutex::new(child.stdin.take().map(spawn_writer)),
            child: Arc::new(Mutex::new(child)),
            tree,
            stopping: AtomicBool::new(false),
            killed: AtomicBool::new(false),
        });
        lock(&self.servers).insert(id.to_string(), server.clone());
        sink.send(McpEvent::Started {
            pid,
            executable: p.executable.to_string_lossy().into_owned(),
        });

        let redact: Arc<Vec<String>> = Arc::new(redaction_forms(
            secrets.into_iter().map(|(_, v)| v).collect(),
        ));
        let readers = [
            stdout.map(|o| read_messages(o, sink.clone(), redact.clone())),
            stderr.map(|e| read_stderr(e, sink.clone(), redact.clone())),
        ];
        let servers = self.servers.clone();
        let id = id.to_string();
        thread::spawn(move || {
            let code = loop {
                match lock(&server.child).try_wait() {
                    Ok(Some(status)) => break status.code(),
                    Ok(None) => {}
                    Err(_) => break None,
                }
                thread::sleep(POLL);
            };
            // whatever it left running dies with it, so the pipes close
            if let Some(t) = &server.tree {
                t.kill();
            }
            for r in readers.into_iter().flatten() {
                let _ = r.join();
            }
            lock(&servers).remove(&id);
            let reason = if server.killed.load(Ordering::SeqCst) {
                "killed"
            } else if server.stopping.load(Ordering::SeqCst) {
                "stopped"
            } else {
                "exited"
            };
            sink.send(McpEvent::Exit {
                reason,
                code,
                message: None,
            });
        });
    }

    /// Write one JSON-RPC message (request, notification or a response to a server request).
    pub fn send(&self, id: &str, message: &Value) -> Result<(), String> {
        check_outgoing(message)?;
        let line = serde_json::to_string(message).map_err(|e| e.to_string())?;
        if line.len() > MAX_SEND_BYTES {
            return Err("message too large".into());
        }
        let server = lock(&self.servers)
            .get(id)
            .cloned()
            .ok_or("this server is not running")?;
        let input = lock(&server.input)
            .clone()
            .ok_or("this server is stopping")?;
        let mut bytes = line.into_bytes();
        bytes.push(b'\n');
        queue_line(&input, bytes, SEND_TIMEOUT)
    }

    /// Close its input (the MCP shutdown signal), wait briefly, then kill the tree.
    pub fn stop(&self, id: &str) {
        let Some(server) = lock(&self.servers).get(id).cloned() else {
            return;
        };
        server.stopping.store(true, Ordering::SeqCst);
        // the writer closes the pipe once the queue is written; a server that stopped
        // reading keeps it open, and is killed below
        lock(&server.input).take();
        let deadline = Instant::now() + STOP_GRACE;
        while Instant::now() < deadline {
            if matches!(lock(&server.child).try_wait(), Ok(Some(_))) {
                return;
            }
            thread::sleep(POLL);
        }
        kill(&server);
    }

    /// Kill every server now (app exit; the Job Objects would do it anyway).
    pub fn kill_all(&self) {
        let all: Vec<Arc<Server>> = lock(&self.servers).values().cloned().collect();
        for s in all {
            s.stopping.store(true, Ordering::SeqCst);
            kill(&s);
        }
    }
}

fn kill(s: &Server) {
    s.killed.store(true, Ordering::SeqCst);
    lock(&s.input).take();
    if let Some(t) = &s.tree {
        t.kill();
    }
    let _ = lock(&s.child).kill();
}

/// A server's input on its own thread: a server that stops reading blocks only that thread.
/// The pipe closes when every sender is gone and the queue is written.
fn spawn_writer(mut pipe: impl Write + Send + 'static) -> SyncSender<Vec<u8>> {
    let (tx, rx) = sync_channel::<Vec<u8>>(SEND_QUEUE);
    thread::spawn(move || {
        for line in rx {
            if pipe.write_all(&line).and_then(|_| pipe.flush()).is_err() {
                break;
            }
        }
    });
    tx
}

/// Queue one line; an error when the queue stays full for `timeout` (the server is not reading).
fn queue_line(tx: &SyncSender<Vec<u8>>, line: Vec<u8>, timeout: Duration) -> Result<(), String> {
    let deadline = Instant::now() + timeout;
    let mut line = line;
    loop {
        match tx.try_send(line) {
            Ok(()) => return Ok(()),
            Err(TrySendError::Disconnected(_)) => {
                return Err("could not write to the server: its input is closed".into())
            }
            Err(TrySendError::Full(back)) => {
                if Instant::now() >= deadline {
                    return Err(
                        "the server is not reading its input (it may be stuck); try stopping it"
                            .into(),
                    );
                }
                line = back;
                thread::sleep(POLL);
            }
        }
    }
}

/// Only JSON-RPC 2.0 requests, notifications and responses go to a server.
pub fn check_outgoing(m: &Value) -> Result<(), String> {
    let o = m.as_object().ok_or("a message must be a JSON object")?;
    if o.get("jsonrpc").and_then(Value::as_str) != Some("2.0") {
        return Err("not a JSON-RPC 2.0 message".into());
    }
    match o.get("method") {
        Some(Value::String(method)) => {
            if method.is_empty() || method.len() > 256 {
                return Err("invalid method".into());
            }
            if o.contains_key("result") || o.contains_key("error") {
                return Err("a request cannot carry a result".into());
            }
            Ok(())
        }
        Some(_) => Err("invalid method".into()),
        None => {
            let id_ok = matches!(o.get("id"), Some(Value::String(_)) | Some(Value::Number(_)));
            if id_ok && (o.contains_key("result") ^ o.contains_key("error")) {
                Ok(())
            } else {
                Err("not a request, notification or response".into())
            }
        }
    }
}

/// The forms a secret can take in a server's output: as is, and escaped inside a JSON string.
pub(crate) fn redaction_forms(values: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for v in values.into_iter().filter(|v| v.len() >= 4) {
        let quoted = serde_json::to_string(&v).unwrap_or_default();
        let escaped = quoted
            .strip_prefix('"')
            .and_then(|s| s.strip_suffix('"'))
            .unwrap_or("")
            .to_string();
        if escaped != v && escaped.len() >= 4 {
            out.push(escaped);
        }
        out.push(v);
    }
    // longer first, so a form that contains another is replaced whole
    out.sort_by_key(|s| std::cmp::Reverse(s.len()));
    out.dedup();
    out
}

fn redact_text(s: &str, secrets: &[String]) -> String {
    let mut out = s.to_string();
    for v in secrets {
        if out.contains(v.as_str()) {
            out = out.replace(v.as_str(), "[secret]");
        }
    }
    out
}

/// Every string in a parsed message, whatever escapes the server used to write it.
fn redact_value(v: &mut Value, secrets: &[String]) {
    match v {
        Value::String(s) => {
            if secrets.iter().any(|x| s.contains(x.as_str())) {
                *s = redact_text(s, secrets);
            }
        }
        Value::Array(a) => a.iter_mut().for_each(|x| redact_value(x, secrets)),
        Value::Object(o) => {
            let keys: Vec<String> = o.keys().cloned().collect();
            for k in keys {
                let Some(mut x) = o.remove(&k) else { continue };
                redact_value(&mut x, secrets);
                o.insert(redact_text(&k, secrets), x);
            }
        }
        _ => {}
    }
}

/// One line at a time, never more than MAX_LINE_BYTES in memory.
fn read_line_capped(r: &mut impl BufRead, buf: &mut Vec<u8>) -> std::io::Result<(usize, bool)> {
    buf.clear();
    let mut total = 0;
    let mut too_long = false;
    loop {
        let chunk = r.fill_buf()?;
        if chunk.is_empty() {
            return Ok((total, too_long));
        }
        let (take, done) = match chunk.iter().position(|&b| b == b'\n') {
            Some(i) => (i + 1, true),
            None => (chunk.len(), false),
        };
        if !too_long {
            if buf.len() + take > MAX_LINE_BYTES {
                too_long = true;
                buf.clear();
            } else {
                buf.extend_from_slice(&chunk[..take]);
            }
        }
        total += take;
        r.consume(take);
        if done {
            return Ok((total, too_long));
        }
    }
}

fn read_messages(
    pipe: impl Read + Send + 'static,
    sink: Arc<dyn McpSink>,
    secrets: Arc<Vec<String>>,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let mut reader = BufReader::with_capacity(64 * 1024, pipe);
        let mut buf = Vec::new();
        loop {
            match read_line_capped(&mut reader, &mut buf) {
                Ok((0, _)) | Err(_) => break,
                Ok((bytes, true)) => sink.send(McpEvent::Invalid {
                    reason: format!("message longer than {} MB", MAX_LINE_BYTES / 1024 / 1024),
                    bytes,
                }),
                Ok((bytes, false)) => {
                    let Ok(text) = std::str::from_utf8(&buf) else {
                        sink.send(McpEvent::Invalid {
                            reason: "not UTF-8".into(),
                            bytes,
                        });
                        continue;
                    };
                    let text = text.trim();
                    if text.is_empty() {
                        continue;
                    }
                    let text = redact_text(text, &secrets);
                    match serde_json::from_str::<Value>(&text) {
                        Ok(mut message) => {
                            if !secrets.is_empty() {
                                redact_value(&mut message, &secrets);
                            }
                            sink.send(McpEvent::Message { message, bytes })
                        }
                        Err(_) => sink.send(McpEvent::Invalid {
                            reason: "not JSON".into(),
                            bytes,
                        }),
                    }
                }
            }
        }
    })
}

fn read_stderr(
    pipe: impl Read + Send + 'static,
    sink: Arc<dyn McpSink>,
    secrets: Arc<Vec<String>>,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let mut reader = BufReader::new(pipe);
        let mut buf = Vec::new();
        loop {
            match read_line_capped(&mut reader, &mut buf) {
                Ok((0, _)) | Err(_) => break,
                Ok((_, too_long)) => {
                    let line = String::from_utf8_lossy(&buf);
                    let line: String = line.trim_end().chars().take(MAX_STDERR_LINE).collect();
                    if line.is_empty() && !too_long {
                        continue;
                    }
                    sink.send(McpEvent::Stderr {
                        line: redact_text(&line, &secrets),
                    });
                }
            }
        }
    })
}

/// The native consent dialog (Windows MessageBox; "No" is the default button).
pub struct DialogConfirm;

impl Confirm for DialogConfirm {
    #[cfg(windows)]
    fn confirm(&self, p: &Prepared) -> bool {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            MessageBoxW, IDYES, MB_DEFBUTTON2, MB_ICONWARNING, MB_SETFOREGROUND, MB_TOPMOST,
            MB_YESNO,
        };
        // never a partial text: what cannot be shown whole is not asked
        let Ok(text) = consent_text(p) else {
            return false;
        };
        let wide = |s: &str| s.encode_utf16().chain(Some(0)).collect::<Vec<u16>>();
        let (text, title) = (wide(&text), wide("RealmNest · Server MCP"));
        let answer = unsafe {
            MessageBoxW(
                std::ptr::null_mut(),
                text.as_ptr(),
                title.as_ptr(),
                MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2 | MB_SETFOREGROUND | MB_TOPMOST,
            )
        };
        answer == IDYES
    }

    #[cfg(not(windows))]
    fn confirm(&self, _p: &Prepared) -> bool {
        // no native dialog yet on other platforms: never start silently
        false
    }
}
