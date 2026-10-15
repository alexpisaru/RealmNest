//! The RealmNest MCP bridge: Claude Code can use RealmNest's tools without
//! bypassing RealmNest.
//!
//! ```text
//!  claude.exe ─stdio─▶ realmnest-os.exe --mcp-bridge ─TCP 127.0.0.1─▶ BridgeHost ─channel─▶ page
//!                                                                   (McpBridgeServer: tools/list,
//!                                                                    tools/call → ToolRuntime →
//!                                                                    permissions / approval)
//! ```
//!
//! For each Claude run with RealmNest tools the page opens a session: Rust
//! writes an MCP config (in RealmNest's own data folder) naming this executable
//! in bridge mode, with the loopback address and a random one-time token in
//! its environment. Claude starts the relay; the relay connects and sends the
//! token; Rust pairs the connection with the session (once) and hands every
//! message to the page. Nothing here executes a tool: the page's ToolRuntime
//! decides, exactly as for every other model. Only loopback, only one
//! connection per token, and the session ends with the run.

use super::{check_outgoing, lock};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
#[cfg(not(windows))]
use std::io::Read;
use std::io::{BufRead, BufReader, Write};
use std::net::{Shutdown, SocketAddr, TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

pub const ADDR_ENV: &str = "REALMNEST_BRIDGE_ADDR";
pub const TOKEN_ENV: &str = "REALMNEST_BRIDGE_TOKEN";
/// the server name Claude sees: its tools are `mcp__realmnest__<tool>`
pub const SERVER_NAME: &str = "realmnest";
pub const DIR_NAME: &str = "realmnest-bridge";
const MAX_MESSAGE: usize = 8 * 1024 * 1024;
const MAX_SESSIONS: usize = 16;
/// connections still identifying themselves (paired ones are bounded by MAX_SESSIONS)
const MAX_PENDING: usize = 4;
/// a relay that stops reading fails the write instead of holding the caller
const WRITE_TIMEOUT: Duration = Duration::from_secs(10);

/// What the page hears about a bridge session.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "t", rename_all = "snake_case")]
pub enum BridgeEvent {
    /// the relay (started by Claude) connected with the right token
    Connected,
    Message {
        message: Value,
    },
    /// the relay went away (Claude ended or was stopped)
    Closed,
}

pub trait BridgeSink: Send + Sync + 'static {
    fn send(&self, e: BridgeEvent);
}

impl BridgeSink for tauri::ipc::Channel<BridgeEvent> {
    fn send(&self, e: BridgeEvent) {
        let _ = tauri::ipc::Channel::send(self, e);
    }
}

struct Session {
    id: String,
    sink: Arc<dyn BridgeSink>,
    stream: Mutex<Option<TcpStream>>,
    used: AtomicBool,
    /// set by close(): the read loop ends whatever the socket reports
    closed: AtomicBool,
    config: PathBuf,
}

#[derive(Default)]
struct Inner {
    addr: Option<SocketAddr>,
    /// token → session
    sessions: HashMap<String, Arc<Session>>,
}

pub struct BridgeHost {
    inner: Arc<Mutex<Inner>>,
    dir: PathBuf,
    exe: PathBuf,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedBridge {
    /// for `claude --mcp-config`
    pub config_path: String,
    pub server_name: &'static str,
}

fn is_session_id(v: &str) -> bool {
    !v.is_empty()
        && v.len() <= 64
        && v.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// 32 random bytes as hex, from the OS.
pub fn random_token() -> Result<String, String> {
    let mut buf = [0u8; 32];
    #[cfg(windows)]
    {
        use windows_sys::Win32::Security::Cryptography::{
            BCryptGenRandom, BCRYPT_USE_SYSTEM_PREFERRED_RNG,
        };
        let status = unsafe {
            BCryptGenRandom(
                std::ptr::null_mut(),
                buf.as_mut_ptr(),
                buf.len() as u32,
                BCRYPT_USE_SYSTEM_PREFERRED_RNG,
            )
        };
        if status != 0 {
            return Err("no system random numbers".into());
        }
    }
    #[cfg(not(windows))]
    {
        std::fs::File::open("/dev/urandom")
            .and_then(|mut f| f.read_exact(&mut buf))
            .map_err(|e| e.to_string())?;
    }
    Ok(buf.iter().map(|b| format!("{b:02x}")).collect())
}

impl BridgeHost {
    /// `dir`: RealmNest's own data folder (configs go in `<dir>/realmnest-bridge`);
    /// `exe`: this executable (Claude starts it in bridge mode).
    pub fn new(dir: PathBuf, exe: PathBuf) -> Self {
        BridgeHost {
            inner: Arc::new(Mutex::new(Inner::default())),
            dir: dir.join(DIR_NAME),
            exe,
        }
    }

    pub fn dir(&self) -> &PathBuf {
        &self.dir
    }

    fn listen(&self) -> Result<SocketAddr, String> {
        if let Some(a) = lock(&self.inner).addr {
            return Ok(a);
        }
        let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
        let addr = listener.local_addr().map_err(|e| e.to_string())?;
        lock(&self.inner).addr = Some(addr);
        let inner = self.inner.clone();
        let pending = Arc::new(AtomicUsize::new(0));
        thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                // a flood of connections that never identify cannot pile up threads
                if pending.fetch_add(1, Ordering::SeqCst) >= MAX_PENDING {
                    pending.fetch_sub(1, Ordering::SeqCst);
                    let _ = stream.shutdown(Shutdown::Both);
                    continue;
                }
                let (inner, pending) = (inner.clone(), pending.clone());
                thread::spawn(move || serve(stream, inner, pending));
            }
        });
        Ok(addr)
    }

    /// A new session for one run: returns the MCP config for Claude.
    pub fn open(
        &self,
        session_id: &str,
        sink: Arc<dyn BridgeSink>,
    ) -> Result<OpenedBridge, String> {
        if !is_session_id(session_id) {
            return Err("invalid session id".into());
        }
        if lock(&self.inner).sessions.len() >= MAX_SESSIONS {
            return Err("too many bridge sessions".into());
        }
        let addr = self.listen()?;
        let token = random_token()?;
        std::fs::create_dir_all(&self.dir).map_err(|e| e.to_string())?;
        let config = self.dir.join(format!("{session_id}.json"));
        let body = serde_json::json!({
            "mcpServers": {
                SERVER_NAME: {
                    "type": "stdio",
                    "command": self.exe.to_string_lossy(),
                    "args": ["--mcp-bridge"],
                    "env": { ADDR_ENV: addr.to_string(), TOKEN_ENV: token },
                }
            }
        });
        std::fs::write(
            &config,
            serde_json::to_vec_pretty(&body).unwrap_or_default(),
        )
        .map_err(|e| e.to_string())?;
        lock(&self.inner).sessions.insert(
            token,
            Arc::new(Session {
                id: session_id.to_string(),
                sink,
                stream: Mutex::new(None),
                used: AtomicBool::new(false),
                closed: AtomicBool::new(false),
                config: config.clone(),
            }),
        );
        Ok(OpenedBridge {
            config_path: config.to_string_lossy().into_owned(),
            server_name: SERVER_NAME,
        })
    }

    fn find(&self, session_id: &str) -> Option<Arc<Session>> {
        self.inner
            .lock()
            .unwrap()
            .sessions
            .values()
            .find(|s| s.id == session_id)
            .cloned()
    }

    /// Answer the relay (responses and notifications from the page's MCP server).
    pub fn send(&self, session_id: &str, message: &Value) -> Result<(), String> {
        check_outgoing(message)?;
        let line = serde_json::to_string(message).map_err(|e| e.to_string())?;
        if line.len() > MAX_MESSAGE {
            return Err("message too large".into());
        }
        let s = self.find(session_id).ok_or("no such bridge session")?;
        let mut guard = lock(&s.stream);
        let stream = guard.as_mut().ok_or("the bridge is not connected")?;
        let mut bytes = line.into_bytes();
        bytes.push(b'\n');
        let written = stream.write_all(&bytes).and_then(|_| stream.flush());
        if let Err(e) = written {
            // a half-written line cannot be recovered: the relay is dropped (Claude sees it go)
            if let Some(st) = guard.take() {
                let _ = st.shutdown(Shutdown::Both);
            }
            return Err(
                if matches!(
                    e.kind(),
                    std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                ) {
                    "the bridge stopped reading (timed out)".to_string()
                } else {
                    e.to_string()
                },
            );
        }
        Ok(())
    }

    /// End a session: the token stops working, the connection closes, the config is deleted.
    pub fn close(&self, session_id: &str) {
        let mut inner = lock(&self.inner);
        let token = inner
            .sessions
            .iter()
            .find(|(_, s)| s.id == session_id)
            .map(|(t, _)| t.clone());
        if let Some(s) = token.and_then(|t| inner.sessions.remove(&t)) {
            s.closed.store(true, Ordering::SeqCst);
            if let Some(stream) = lock(&s.stream).take() {
                let _ = stream.shutdown(Shutdown::Both);
            }
            let _ = std::fs::remove_file(&s.config);
        }
    }

    pub fn close_all(&self) {
        let ids: Vec<String> = self
            .inner
            .lock()
            .unwrap()
            .sessions
            .values()
            .map(|s| s.id.clone())
            .collect();
        for id in ids {
            self.close(&id);
        }
    }
}

/// The first line (at most 200 bytes) within `within` in total; what follows stays buffered.
fn read_token(reader: &mut BufReader<TcpStream>, within: Duration) -> Option<String> {
    let deadline = std::time::Instant::now() + within;
    let mut token = Vec::new();
    loop {
        let left = deadline
            .checked_duration_since(std::time::Instant::now())
            .filter(|d| !d.is_zero())?;
        reader.get_ref().set_read_timeout(Some(left)).ok()?;
        let chunk = reader.fill_buf().ok()?;
        if chunk.is_empty() {
            return None;
        }
        let (take, done) = match chunk.iter().position(|&b| b == b'\n') {
            Some(i) => (i + 1, true),
            None => (chunk.len(), false),
        };
        token.extend_from_slice(&chunk[..take]);
        reader.consume(take);
        if token.len() > 200 {
            return None;
        }
        if done {
            return Some(String::from_utf8_lossy(&token).trim().to_string());
        }
    }
}

/// One relay connection: the token first, then JSON-RPC lines both ways.
fn serve(stream: TcpStream, inner: Arc<Mutex<Inner>>, pending: Arc<AtomicUsize>) {
    // counted as pending until the token phase ends, whatever the outcome
    struct Pending(Arc<AtomicUsize>);
    impl Drop for Pending {
        fn drop(&mut self) {
            self.0.fetch_sub(1, Ordering::SeqCst);
        }
    }
    let identifying = Pending(pending);
    // only this machine; a peer that does not identify quickly is dropped
    if !stream
        .peer_addr()
        .map(|a| a.ip().is_loopback())
        .unwrap_or(false)
    {
        return;
    }
    let Ok(read) = stream.try_clone() else { return };
    let mut reader = BufReader::new(read);
    // the token: one short line, within 5 seconds in all (a trickle cannot hold a slot)
    let Some(token) = read_token(&mut reader, Duration::from_secs(5)) else {
        return;
    };
    let session = lock(&inner).sessions.get(&token).cloned();
    let Some(session) = session else { return };
    if session.used.swap(true, Ordering::SeqCst) {
        return; // a token works once
    }
    drop(identifying);
    let _ = stream.set_write_timeout(Some(WRITE_TIMEOUT));
    // the token is in: wait as long as the run needs (an approval can take minutes).
    // The read side wakes every second only to notice close(): on Windows a
    // shutdown through another handle does not wake a blocked read.
    let _ = stream.set_read_timeout(None);
    let _ = reader
        .get_ref()
        .set_read_timeout(Some(Duration::from_secs(1)));
    *lock(&session.stream) = Some(stream);
    session.sink.send(BridgeEvent::Connected);
    // one JSON-RPC message per line; a line may arrive in pieces across wake-ups
    let mut line: Vec<u8> = Vec::new();
    let mut overflow = false;
    loop {
        let chunk = match reader.fill_buf() {
            Ok([]) => break,
            Ok(c) => c,
            // a timeout is not the end; a closed session is
            Err(e)
                if !session.closed.load(Ordering::SeqCst)
                    && matches!(
                        e.kind(),
                        std::io::ErrorKind::WouldBlock
                            | std::io::ErrorKind::TimedOut
                            | std::io::ErrorKind::Interrupted
                    ) =>
            {
                continue
            }
            Err(_) => break,
        };
        let (take, done) = match chunk.iter().position(|&b| b == b'\n') {
            Some(i) => (i + 1, true),
            None => (chunk.len(), false),
        };
        if !overflow {
            if line.len() + take > MAX_MESSAGE {
                overflow = true; // over the size cap: this message is dropped
                line.clear();
            } else {
                line.extend_from_slice(&chunk[..take]);
            }
        }
        reader.consume(take);
        if done {
            if !overflow {
                if let Ok(text) = std::str::from_utf8(&line) {
                    let text = text.trim();
                    if !text.is_empty() {
                        if let Ok(message) = serde_json::from_str::<Value>(text) {
                            session.sink.send(BridgeEvent::Message { message });
                        }
                    }
                }
            }
            line.clear();
            overflow = false;
        }
    }
    session.sink.send(BridgeEvent::Closed);
}

/// `realmnest-os.exe --mcp-bridge`: relay stdio (Claude) ⇄ the running RealmNest.
/// Exit code 0 when either side closes, 2 when it cannot connect.
pub fn run_relay() -> i32 {
    let (Ok(addr), Ok(token)) = (std::env::var(ADDR_ENV), std::env::var(TOKEN_ENV)) else {
        eprintln!("realmnest-os --mcp-bridge: started without a bridge session");
        return 2;
    };
    let Ok(addr) = addr.parse::<SocketAddr>() else {
        return 2;
    };
    if !addr.ip().is_loopback() {
        return 2;
    }
    let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_secs(5)) else {
        eprintln!("realmnest-os --mcp-bridge: RealmNest is not reachable");
        return 2;
    };
    if stream.write_all(format!("{token}\n").as_bytes()).is_err() {
        return 2;
    }
    let Ok(from_app) = stream.try_clone() else {
        return 2;
    };
    // Claude → RealmNest, until Claude closes our stdin
    thread::spawn(move || {
        let _ = std::io::copy(&mut std::io::stdin().lock(), &mut stream);
        let _ = stream.shutdown(Shutdown::Both);
    });
    // RealmNest → Claude; when RealmNest ends the session (or quits) the relay ends too,
    // so Claude sees its MCP server go away instead of waiting for an answer
    let mut stdout = std::io::stdout().lock();
    let _ = std::io::copy(&mut BufReader::new(from_app), &mut stdout);
    let _ = stdout.flush();
    0
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(windows)]
    use std::io::Read;
    use std::sync::mpsc;

    struct Collect(Mutex<mpsc::Sender<BridgeEvent>>);
    impl BridgeSink for Collect {
        fn send(&self, e: BridgeEvent) {
            let _ = self.0.lock().unwrap().send(e);
        }
    }

    fn config(path: &str) -> (SocketAddr, String) {
        let v: Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
        let env = &v["mcpServers"]["realmnest"]["env"];
        assert_eq!(v["mcpServers"]["realmnest"]["args"][0], "--mcp-bridge");
        (
            env[ADDR_ENV].as_str().unwrap().parse().unwrap(),
            env[TOKEN_ENV].as_str().unwrap().to_string(),
        )
    }

    #[test]
    fn pairs_one_relay_by_token_and_relays_both_ways() {
        let dir =
            std::env::temp_dir().join(format!("realmnest-bridge-test-{}", std::process::id()));
        let host = BridgeHost::new(dir.clone(), PathBuf::from("C:\\realmnest-os.exe"));
        let (tx, rx) = mpsc::channel();
        let opened = host
            .open("run-1", Arc::new(Collect(Mutex::new(tx))))
            .unwrap();
        assert!(opened.config_path.contains(DIR_NAME));
        let (addr, token) = config(&opened.config_path);
        assert_eq!(token.len(), 64);

        // a wrong token gets nothing
        let mut bad = TcpStream::connect(addr).unwrap();
        bad.write_all(b"nope\n").unwrap();
        bad.write_all(b"{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}\n")
            .unwrap();

        let mut relay = TcpStream::connect(addr).unwrap();
        relay.write_all(format!("{token}\n").as_bytes()).unwrap();
        assert_eq!(
            rx.recv_timeout(Duration::from_secs(5)).unwrap(),
            BridgeEvent::Connected
        );
        relay
            .write_all(b"{\"jsonrpc\":\"2.0\",\"id\":7,\"method\":\"tools/list\"}\n")
            .unwrap();
        let BridgeEvent::Message { message } = rx.recv_timeout(Duration::from_secs(5)).unwrap()
        else {
            panic!()
        };
        assert_eq!(message["id"], 7);
        host.send(
            "run-1",
            &serde_json::json!({"jsonrpc":"2.0","id":7,"result":{"tools":[]}}),
        )
        .unwrap();
        let mut back = String::new();
        BufReader::new(relay.try_clone().unwrap())
            .read_line(&mut back)
            .unwrap();
        assert!(back.contains("\"id\":7"));

        // the token works once
        let mut again = TcpStream::connect(addr).unwrap();
        again.write_all(format!("{token}\n").as_bytes()).unwrap();
        assert!(rx.recv_timeout(Duration::from_millis(300)).is_err());

        // closing ends the connection and deletes the config
        host.close("run-1");
        assert_eq!(
            rx.recv_timeout(Duration::from_secs(5)).unwrap(),
            BridgeEvent::Closed
        );
        assert!(!std::path::Path::new(&opened.config_path).exists());
        assert!(host
            .send(
                "run-1",
                &serde_json::json!({"jsonrpc":"2.0","id":8,"result":{}})
            )
            .is_err());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_quiet_session_stays_open_past_the_token_timeout() {
        let dir =
            std::env::temp_dir().join(format!("realmnest-bridge-quiet-{}", std::process::id()));
        let host = BridgeHost::new(dir.clone(), PathBuf::from("C:\realmnest-os.exe"));
        let (tx, rx) = mpsc::channel();
        let opened = host
            .open("run-q", Arc::new(Collect(Mutex::new(tx))))
            .unwrap();
        let (addr, token) = config(&opened.config_path);
        let mut relay = TcpStream::connect(addr).unwrap();
        relay
            .write_all(
                format!(
                    "{token}
"
                )
                .as_bytes(),
            )
            .unwrap();
        assert_eq!(
            rx.recv_timeout(Duration::from_secs(5)).unwrap(),
            BridgeEvent::Connected
        );
        // longer than the 5 s allowed for the token: an approval can take this long
        thread::sleep(Duration::from_secs(6));
        assert!(rx.try_recv().is_err(), "the session closed while idle");
        relay
            .write_all(
                b"{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"ping\"}
",
            )
            .unwrap();
        assert!(matches!(
            rx.recv_timeout(Duration::from_secs(5)).unwrap(),
            BridgeEvent::Message { .. }
        ));
        host.close("run-q");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn refuses_bad_session_ids_and_requests_with_results() {
        let host = BridgeHost::new(std::env::temp_dir(), PathBuf::from("x"));
        let (tx, _rx) = mpsc::channel();
        assert!(host
            .open("../evil", Arc::new(Collect(Mutex::new(tx))))
            .is_err());
        assert!(host
            .send(
                "nope",
                &serde_json::json!({"jsonrpc":"2.0","id":1,"result":{}})
            )
            .is_err());
        assert_eq!(random_token().unwrap().len(), 64);
        assert_ne!(random_token().unwrap(), random_token().unwrap());
    }

    #[test]
    fn silent_connections_are_capped_and_a_stuck_relay_fails_the_write() {
        let dir = std::env::temp_dir().join(format!("realmnest-bridge-cap-{}", std::process::id()));
        let host = BridgeHost::new(dir.clone(), PathBuf::from("C:\\realmnest-os.exe"));
        let (tx, rx) = mpsc::channel();
        let opened = host
            .open("run-c", Arc::new(Collect(Mutex::new(tx))))
            .unwrap();
        let (addr, token) = config(&opened.config_path);
        // connections that never identify: only MAX_PENDING are kept, the next is dropped at once
        let silent: Vec<TcpStream> = (0..MAX_PENDING)
            .map(|_| TcpStream::connect(addr).unwrap())
            .collect();
        thread::sleep(Duration::from_millis(300));
        let mut extra = TcpStream::connect(addr).unwrap();
        extra
            .set_read_timeout(Some(Duration::from_secs(3)))
            .unwrap();
        let mut b = [0u8; 1];
        assert!(matches!(extra.read(&mut b), Ok(0) | Err(_)));
        // a trickle cannot hold a slot past the token deadline
        for mut s in silent.iter() {
            let _ = s.write_all(b"a");
        }
        thread::sleep(Duration::from_secs(6));
        let relay = TcpStream::connect(addr).unwrap();
        (&relay).write_all(format!("{token}\n").as_bytes()).unwrap();
        assert_eq!(
            rx.recv_timeout(Duration::from_secs(5)).unwrap(),
            BridgeEvent::Connected
        );
        // the relay never reads: a write fails within the write timeout instead of hanging
        let big =
            serde_json::json!({"jsonrpc":"2.0","id":1,"result":{"x":"y".repeat(4 * 1024 * 1024)}});
        let started = std::time::Instant::now();
        let mut failed = false;
        for _ in 0..64 {
            if host.send("run-c", &big).is_err() {
                failed = true;
                break;
            }
        }
        assert!(failed, "the writes never failed");
        assert!(started.elapsed() < WRITE_TIMEOUT + Duration::from_secs(10));
        // the half-written relay is dropped
        assert!(host.send("run-c", &big).is_err());
        drop(silent);
        drop(relay);
        host.close("run-c");
        let _ = std::fs::remove_dir_all(dir);
    }
}
