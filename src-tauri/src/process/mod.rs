//! Native process host for the desktop app: the Rust twin of
//! `src/runtime/process/node/runner.ts`. The frontend sends a typed
//! `RunRequest`; Rust validates program, arguments, stdin and cwd itself,
//! spawns without a shell, streams output back, and owns cancellation,
//! timeouts and process-tree cleanup. Each run has its own id, so several can
//! run at once.

pub mod protocol;
pub mod tree;

use crate::programs::HostProgram;
use protocol::{ProcessEnd, ProcessMessage, ProgramLocation, RunRequest, SpawnErrorCode};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

// a prompt plus chat attachments (images / PDFs as base64 stream-json)
const MAX_STDIN_BYTES: usize = 24_000_000;
const MAX_ARGS: usize = 64;
const DEFAULT_TIMEOUT_MS: u64 = 5 * 60_000;
const MAX_TIMEOUT_MS: u64 = 30 * 60_000;
const MIN_TIMEOUT_MS: u64 = 1_000;
const POLL: Duration = Duration::from_millis(25);
/// one output line (stream-json: a message, possibly with an attachment echoed back)
const MAX_LINE_BYTES: usize = 32 * 1024 * 1024;
/// how long `end` waits for the output readers once the process tree is gone
const DRAIN: Duration = Duration::from_secs(5);

/// Where a run's messages go (a Tauri channel in the app, a collector in tests).
pub trait Sink: Send + Sync + 'static {
    fn send(&self, m: ProcessMessage);
}

impl Sink for tauri::ipc::Channel<ProcessMessage> {
    fn send(&self, m: ProcessMessage) {
        // the window may be gone; nothing else to do with the message then
        let _ = tauri::ipc::Channel::send(self, m);
    }
}

struct Run {
    cancel: AtomicBool,
    tree: Mutex<Option<Arc<tree::Tree>>>,
}

/// The live runs, by id.
pub struct ProcessHost {
    programs: Vec<Arc<dyn HostProgram>>,
    runs: Arc<Mutex<HashMap<String, Arc<Run>>>>,
    counter: AtomicU64,
}

impl ProcessHost {
    pub fn new(programs: Vec<Arc<dyn HostProgram>>) -> Self {
        ProcessHost {
            programs,
            runs: Arc::new(Mutex::new(HashMap::new())),
            counter: AtomicU64::new(0),
        }
    }

    fn program(&self, id: &str) -> Option<Arc<dyn HostProgram>> {
        self.programs.iter().find(|p| p.id() == id).cloned()
    }

    pub fn locate(&self, program: &str) -> ProgramLocation {
        match self.program(program).and_then(|p| p.locate()) {
            Some(r) => ProgramLocation {
                found: true,
                path: Some(r.path),
                source: Some(r.source.to_string()),
            },
            None => ProgramLocation {
                found: false,
                path: None,
                source: None,
            },
        }
    }

    /// ids of runs still alive
    pub fn active(&self) -> Vec<String> {
        let mut ids: Vec<String> = self.runs.lock().unwrap().keys().cloned().collect();
        ids.sort();
        ids
    }

    /// Ask a run to stop. False if it is unknown or already finished.
    pub fn cancel(&self, id: &str) -> bool {
        match self.runs.lock().unwrap().get(id) {
            Some(run) => {
                run.cancel.store(true, Ordering::SeqCst);
                true
            }
            None => false,
        }
    }

    /// Kill every run now (app exit).
    pub fn kill_all(&self) {
        for run in self.runs.lock().unwrap().values() {
            run.cancel.store(true, Ordering::SeqCst);
            if let Some(t) = run.tree.lock().unwrap().as_ref() {
                t.kill();
            }
        }
    }

    /// Start a run. Returns its id at once; everything else, including a refusal,
    /// arrives on `sink` and always ends with exactly one `end` message.
    pub fn start(&self, req: RunRequest, sink: Arc<dyn Sink>) -> String {
        let n = self.counter.fetch_add(1, Ordering::SeqCst) + 1;
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(0);
        let id = format!("p{n}-{nanos:08x}");
        let run = Arc::new(Run {
            cancel: AtomicBool::new(false),
            tree: Mutex::new(None),
        });

        let prepared = self.prepare(&req);
        let (program, cwd, timeout) = match prepared {
            Ok(p) => p,
            Err(end) => {
                sink.send(ProcessMessage::End { end });
                return id;
            }
        };
        self.runs.lock().unwrap().insert(id.clone(), run.clone());
        let runs = self.runs.clone();
        let rid = id.clone();
        thread::spawn(move || {
            let end = execute(program.as_ref(), &req, &cwd, timeout, &run, &sink);
            runs.lock().unwrap().remove(&rid);
            sink.send(ProcessMessage::End { end });
        });
        id
    }

    /// Everything that can be refused before spawning, checked here in Rust.
    fn prepare(
        &self,
        req: &RunRequest,
    ) -> Result<(Arc<dyn HostProgram>, PathBuf, Duration), ProcessEnd> {
        let program = self.program(&req.program).ok_or_else(|| {
            ProcessEnd::denied(format!(
                "program \"{}\" is not allowed",
                req.program.chars().take(40).collect::<String>()
            ))
        })?;
        if req.args.len() > MAX_ARGS {
            return Err(ProcessEnd::denied("too many arguments"));
        }
        program.check_args(&req.args).map_err(ProcessEnd::denied)?;
        if let Some(env) = &req.env {
            if env.len() > 8 {
                return Err(ProcessEnd::denied("too many environment variables"));
            }
            program.check_env(env).map_err(ProcessEnd::denied)?;
        }
        if req
            .stdin
            .as_ref()
            .is_some_and(|s| s.len() > MAX_STDIN_BYTES)
        {
            return Err(ProcessEnd::denied("stdin too large"));
        }
        let cwd = match &req.cwd {
            Some(_) if !program.accepts_cwd() => {
                return Err(ProcessEnd::denied(
                    "this program runs only in RealmNest's own folder",
                ))
            }
            Some(c) => {
                let p = PathBuf::from(c);
                if !p.is_absolute() || !p.is_dir() {
                    return Err(ProcessEnd::denied(
                        "workspace must be an existing absolute directory",
                    ));
                }
                p
            }
            None => {
                let p = program.default_cwd();
                std::fs::create_dir_all(&p).map_err(|e| ProcessEnd::SpawnError {
                    code: SpawnErrorCode::Failed,
                    message: format!("cannot create workspace: {e}"),
                })?;
                p
            }
        };
        let ms = req
            .timeout_ms
            .unwrap_or(DEFAULT_TIMEOUT_MS)
            .clamp(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS);
        Ok((program, cwd, Duration::from_millis(ms)))
    }
}

/// One line at a time, never more than `max` bytes in memory: a longer line is skipped
/// (`(bytes read, true)`). `(0, _)` at the end of the stream.
pub(crate) fn read_line_capped(
    r: &mut impl BufRead,
    buf: &mut Vec<u8>,
    max: usize,
) -> std::io::Result<(usize, bool)> {
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
            if buf.len() + take > max {
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

/// Stream a pipe line by line (stream-json is line based); invalid UTF-8 is replaced, a line
/// over MAX_LINE_BYTES is dropped with a note on stderr.
fn pump(
    pipe: impl Read + Send + 'static,
    sink: Arc<dyn Sink>,
    out: bool,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let mut reader = BufReader::with_capacity(64 * 1024, pipe);
        let mut buf = Vec::new();
        loop {
            match read_line_capped(&mut reader, &mut buf, MAX_LINE_BYTES) {
                Ok((0, _)) | Err(_) => break,
                Ok((n, true)) => sink.send(ProcessMessage::Err {
                    d: format!(
                        "[RealmNest] an output line of {n} bytes was too long and was dropped\n"
                    ),
                }),
                Ok(_) => {
                    let d = String::from_utf8_lossy(&buf).into_owned();
                    sink.send(if out {
                        ProcessMessage::Out { d }
                    } else {
                        ProcessMessage::Err { d }
                    });
                }
            }
        }
    })
}

/// Wait for the output readers, but not forever: a grandchild outside the job (no Job Object)
/// may keep a pipe open. Readers still running after `limit` are left to finish on their own.
pub(crate) fn join_for(handles: impl IntoIterator<Item = thread::JoinHandle<()>>, limit: Duration) {
    let deadline = Instant::now() + limit;
    for h in handles {
        while !h.is_finished() && Instant::now() < deadline {
            thread::sleep(POLL);
        }
        if h.is_finished() {
            let _ = h.join();
        }
    }
}

fn execute(
    program: &dyn HostProgram,
    req: &RunRequest,
    cwd: &Path,
    timeout: Duration,
    run: &Run,
    sink: &Arc<dyn Sink>,
) -> ProcessEnd {
    let Some(resolved) = program.locate() else {
        return ProcessEnd::SpawnError {
            code: SpawnErrorCode::NotFound,
            message: format!("{} was not found on this computer", program.id()),
        };
    };
    if run.cancel.load(Ordering::SeqCst) {
        return ProcessEnd::Cancelled;
    }
    let args = match program.expand_args(&req.args) {
        Ok(a) => a,
        Err(m) => return ProcessEnd::denied(m),
    };
    let mut cmd = Command::new(&resolved.command);
    cmd.args(&resolved.prefix_args)
        .args(&args)
        .current_dir(cwd)
        .env_clear()
        .envs(
            program.env(
                std::env::vars_os()
                    .filter_map(|(k, v)| Some((k.into_string().ok()?, v.into_string().ok()?)))
                    .collect(),
            ),
        )
        // the request's extra variables, already checked by the program
        .envs(req.env.iter().flatten())
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
            let code = match e.kind() {
                std::io::ErrorKind::NotFound => SpawnErrorCode::NotFound,
                std::io::ErrorKind::PermissionDenied => SpawnErrorCode::Denied,
                _ => SpawnErrorCode::Failed,
            };
            return ProcessEnd::SpawnError {
                code,
                message: e.to_string(),
            };
        }
    };
    let tree = tree::Tree::adopt(&child).map(Arc::new);
    *run.tree.lock().unwrap() = tree.clone();
    sink.send(ProcessMessage::Spawn);

    let pumps = [
        pump(child.stdout.take().unwrap(), sink.clone(), true),
        pump(child.stderr.take().unwrap(), sink.clone(), false),
    ];

    if let Some(mut stdin) = child.stdin.take() {
        let data = req.stdin.clone().unwrap_or_default();
        // its own thread: a child that does not read stdin must not block us
        thread::spawn(move || {
            let _ = stdin.write_all(data.as_bytes());
        });
    }

    let deadline = Instant::now() + timeout;
    let mut reason: Option<ProcessEnd> = None;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Some(status),
            Ok(None) => {}
            Err(_) => break None,
        }
        if reason.is_none() {
            if run.cancel.load(Ordering::SeqCst) {
                reason = Some(ProcessEnd::Cancelled);
            } else if Instant::now() >= deadline {
                reason = Some(ProcessEnd::Timeout {
                    timeout_ms: timeout.as_millis() as u64,
                });
            }
            if reason.is_some() {
                tree::kill(tree.as_deref(), &mut child);
            }
        }
        thread::sleep(POLL);
    };
    // killed from outside the loop (kill_all) before the flag was seen: still a cancel
    if reason.is_none() && run.cancel.load(Ordering::SeqCst) {
        reason = Some(ProcessEnd::Cancelled);
    }
    // the child is gone: end whatever it left running, so the pipes close too
    if let Some(t) = &tree {
        t.kill();
    }
    // all output is delivered before `end` (bounded: see join_for)
    join_for(pumps, DRAIN);
    if let Some(r) = reason {
        return r;
    }
    match status {
        Some(s) => ProcessEnd::Exit {
            code: s.code(),
            signal: if s.code().is_none() {
                Some("killed".into())
            } else {
                None
            },
        },
        None => ProcessEnd::Exit {
            code: None,
            signal: Some("lost".into()),
        },
    }
}

#[cfg(test)]
mod tests;
