//! MCP servers online (Streamable HTTP): the same events as a stdio server, so the page's
//! McpClient does not know the difference. Each JSON-RPC message is POSTed to the server's
//! URL; the answer comes back as JSON or as a short event stream, and every message in it
//! is handed to the page. The session id the server gives (`Mcp-Session-Id`) is sent back.
//!
//! - https only (http only for this computer: 127.0.0.1, localhost, ::1), no redirects;
//! - header values the user marked secret are read here from the credential store
//!   (`mcp.<server id>.<NAME>`), never sent by the page, and only to the address (origin)
//!   they were first sent to: another address needs the value typed again;
//! - OAuth (oauth.rs): the access token is added here and refreshed when it expires, only
//!   for the address it was issued for; a server that answers 401 ends the connection as
//!   `auth_required`;
//! - every request has a total time limit, and a body that stops arriving is cut off.

use super::oauth;
use super::{is_env_name, is_server_id, lock, McpEvent, McpSink, Secrets};
use crate::openrouter::sse::{SseItem, SseParser};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

const MAX_BODY: usize = super::MAX_LINE_BYTES;
const MAX_HEADERS: usize = 16;
const MAX_RUNNING: usize = 32;
/// nothing new on an answer for this long: it is over
const IDLE: Duration = Duration::from_secs(600);
/// one request, answer included, never takes longer (the longest tool timeouts fit)
const MAX_REQUEST: Duration = Duration::from_secs(30 * 60);

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpLaunch {
    pub server_id: String,
    pub url: String,
    /// plain headers
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
    /// header → credential-store name (`mcp.<server id>.<NAME>`)
    #[serde(default)]
    pub secret_headers: BTreeMap<String, String>,
    /// signed in with OAuth (tokens in the credential store)
    #[serde(default)]
    pub oauth: bool,
}

struct Server {
    url: url::Url,
    headers: Vec<(String, String)>,
    oauth: bool,
    session: Mutex<Option<String>>,
    protocol: Mutex<Option<String>>,
    sink: Arc<dyn McpSink>,
    closed: AtomicBool,
}

/// the addresses an online server may have: https anywhere, http only on this computer
pub fn check_url(raw: &str) -> Result<url::Url, String> {
    let u = url::Url::parse(raw.trim()).map_err(|_| "not a valid address".to_string())?;
    if !u.username().is_empty() || u.password().is_some() {
        return Err("put credentials in a header, not in the address".into());
    }
    let local = matches!(
        u.host_str(),
        Some("127.0.0.1") | Some("localhost") | Some("[::1]")
    );
    match u.scheme() {
        "https" => Ok(u),
        "http" if local => Ok(u),
        "http" => {
            Err("online servers must use https (http only for a server on this computer)".into())
        }
        _ => Err("only https addresses are allowed".into()),
    }
}

fn is_header_name(n: &str) -> bool {
    let lower = n.to_ascii_lowercase();
    !n.is_empty()
        && n.len() <= 64
        && n.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
        && ![
            "host",
            "content-length",
            "content-type",
            "accept",
            "connection",
            "transfer-encoding",
            "mcp-session-id",
            "mcp-protocol-version",
            "cookie",
        ]
        .contains(&lower.as_str())
}

/// A whole JSON answer: size-capped, and cut off when nothing arrives for `idle`.
async fn read_body(resp: &mut reqwest::Response, idle: Duration) -> Result<Vec<u8>, &'static str> {
    let mut body = Vec::new();
    loop {
        match tokio::time::timeout(idle, resp.chunk()).await {
            Ok(Ok(Some(c))) => {
                body.extend_from_slice(&c);
                if body.len() > MAX_BODY {
                    return Err("the server's answer is too large");
                }
            }
            Ok(Ok(None)) => return Ok(body),
            Ok(Err(e)) if e.is_timeout() => {
                return Err("the server did not finish its answer in time")
            }
            Ok(Err(_)) => return Err("the server's answer was cut off"),
            Err(_) => return Err("the server stopped sending its answer"),
        }
    }
}

fn is_header_value(v: &str) -> bool {
    !v.is_empty() && v.len() <= 8192 && !v.chars().any(|c| c == '\r' || c == '\n' || c == '\0')
}

pub struct HttpHost {
    client: reqwest::Client,
    servers: Mutex<HashMap<String, Arc<Server>>>,
    secrets: Arc<dyn Secrets>,
}

impl HttpHost {
    pub fn new(secrets: Arc<dyn Secrets>) -> Arc<Self> {
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(15))
            .user_agent("RealmNest")
            .build()
            .expect("HTTP client");
        Arc::new(HttpHost {
            client,
            servers: Mutex::new(HashMap::new()),
            secrets,
        })
    }

    /// A header secret goes only to the origin it was first sent to (recorded beside it in the
    /// credential store; storing a new value from the page clears the record).
    fn bind_origin(&self, secret: &str, origin: &str) -> Result<(), String> {
        let at = crate::secrets::origin_ref(secret);
        match self.secrets.read(&at)? {
            Some(o) if o == origin => Ok(()),
            Some(o) => Err(format!(
                "its stored value belongs to {o}; enter it again to use it with {origin}"
            )),
            None => self.secrets.write(&at, origin),
        }
    }

    /// Check the launch and get ready; reports `started` (or an `exit` saying why not).
    pub fn start(&self, l: HttpLaunch, sink: Arc<dyn McpSink>) {
        let refuse = |reason: &'static str, m: String| sink.send(McpEvent::exit(reason, m));
        if !is_server_id(&l.server_id) {
            return refuse("refused", "invalid server id".into());
        }
        let url = match check_url(&l.url) {
            Ok(u) => u,
            Err(e) => return refuse("refused", e),
        };
        if l.headers.len() + l.secret_headers.len() > MAX_HEADERS {
            return refuse("refused", "too many headers".into());
        }
        let origin = url.origin().ascii_serialization();
        let mut headers = Vec::new();
        for (k, v) in &l.headers {
            if !is_header_name(k) || !is_header_value(v) {
                return refuse(
                    "refused",
                    format!(
                        "header not allowed: {}",
                        k.chars().take(40).collect::<String>()
                    ),
                );
            }
            headers.push((k.clone(), v.clone()));
        }
        for (k, r) in &l.secret_headers {
            let var = r
                .strip_prefix(&format!("mcp.{}.", l.server_id))
                .unwrap_or("");
            if !is_header_name(k) || !is_env_name(var) {
                return refuse(
                    "refused",
                    format!(
                        "secret header not allowed: {}",
                        k.chars().take(40).collect::<String>()
                    ),
                );
            }
            match self.secrets.read(r) {
                Ok(Some(v)) if is_header_value(&v) => {
                    if let Err(e) = self.bind_origin(r, &origin) {
                        return refuse("refused", format!("header {k}: {e}"));
                    }
                    headers.push((k.clone(), v))
                }
                Ok(_) => {
                    return refuse(
                        "missing_secret",
                        format!("no value is stored for the header {k}"),
                    )
                }
                Err(e) => return refuse("refused", e),
            }
        }
        if l.oauth {
            match oauth::stored(&l.server_id) {
                None => return refuse("auth_required", "sign in to this server first".into()),
                // a sign-in is for the address it was made for, never another one
                Some(t) if !oauth::issued_for(&t, &url) => {
                    return refuse(
                        "auth_required",
                        "the sign-in was made for another address: sign in again".into(),
                    )
                }
                Some(_) => {}
            }
        }
        {
            let mut all = lock(&self.servers);
            if all.contains_key(&l.server_id) {
                return refuse("refused", "this server is already connected".into());
            }
            if all.len() >= MAX_RUNNING {
                return refuse("refused", "too many MCP servers are connected".into());
            }
            all.insert(
                l.server_id.clone(),
                Arc::new(Server {
                    url: url.clone(),
                    headers,
                    oauth: l.oauth,
                    session: Mutex::new(None),
                    protocol: Mutex::new(None),
                    sink: sink.clone(),
                    closed: AtomicBool::new(false),
                }),
            );
        }
        sink.send(McpEvent::Started {
            pid: 0,
            executable: url.to_string(),
        });
    }

    /// POST one message; what comes back arrives as `message` events.
    pub fn send(self: &Arc<Self>, server_id: &str, message: Value) -> Result<(), String> {
        let server = self
            .servers
            .lock()
            .unwrap()
            .get(server_id)
            .cloned()
            .ok_or("this server is not connected")?;
        let size = serde_json::to_vec(&message)
            .map(|v| v.len())
            .unwrap_or(usize::MAX);
        if size > super::MAX_SEND_BYTES {
            return Err("message too large".into());
        }
        let host = self.clone();
        let sid = server_id.to_string();
        tauri::async_runtime::spawn(async move { host.post(&sid, server, message, true).await });
        Ok(())
    }

    fn fail(&self, server: &Server, message: &Value, text: &str) {
        if let Some(id) = message.get("id").filter(|i| !i.is_null()) {
            server.sink.send(McpEvent::Message {
                message: json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32000, "message": text } }),
                bytes: 0,
            });
        }
    }

    fn end(&self, server_id: &str, reason: &'static str, text: &str) {
        if let Some(s) = lock(&self.servers).remove(server_id) {
            s.closed.store(true, Ordering::SeqCst);
            s.sink.send(McpEvent::exit(reason, text));
        }
    }

    async fn post(&self, server_id: &str, server: Arc<Server>, message: Value, may_refresh: bool) {
        let mut req = self
            .client
            .post(server.url.clone())
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream")
            .timeout(MAX_REQUEST)
            .body(serde_json::to_vec(&message).unwrap_or_default());
        for (k, v) in &server.headers {
            req = req.header(k.as_str(), v.as_str());
        }
        if let Some(s) = lock(&server.session).clone() {
            req = req.header("Mcp-Session-Id", s);
        }
        if let Some(p) = lock(&server.protocol).clone() {
            req = req.header("MCP-Protocol-Version", p);
        }
        if server.oauth {
            match oauth::access_token(server_id, false).await {
                Ok(t) => req = req.header("Authorization", format!("Bearer {t}")),
                Err(e) => {
                    self.fail(&server, &message, &e);
                    return self.end(server_id, "auth_required", &e);
                }
            }
        }
        let resp = match req.send().await {
            Ok(r) => r,
            Err(e) => {
                let text = if e.is_connect() {
                    "the server could not be reached"
                } else if e.is_timeout() {
                    "the server did not answer in time"
                } else {
                    "the request to the server failed"
                };
                return self.fail(&server, &message, text);
            }
        };
        if server.closed.load(Ordering::SeqCst) {
            return;
        }
        if let Some(s) = resp
            .headers()
            .get("mcp-session-id")
            .and_then(|v| v.to_str().ok())
        {
            if s.len() <= 256 && s.bytes().all(|b| (0x21..=0x7e).contains(&b)) {
                *lock(&server.session) = Some(s.to_string());
            }
        }
        let status = resp.status().as_u16();
        if status == 401 || status == 403 {
            if status == 401
                && server.oauth
                && may_refresh
                && oauth::access_token(server_id, true).await.is_ok()
            {
                return Box::pin(self.post(server_id, server, message, false)).await;
            }
            let text = if server.oauth {
                "the server asks to sign in again"
            } else {
                "the server refused the credentials (check the header)"
            };
            self.fail(&server, &message, text);
            return self.end(server_id, "auth_required", text);
        }
        if status == 404 && lock(&server.session).is_some() {
            *lock(&server.session) = None;
            self.fail(
                &server,
                &message,
                "the server ended the session; connect again",
            );
            return self.end(server_id, "exited", "the server ended the session");
        }
        if status == 202 || status == 204 {
            return;
        }
        if !(200..300).contains(&status) {
            return self.fail(
                &server,
                &message,
                &format!("the server answered HTTP {status}"),
            );
        }
        let event_stream = resp
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .is_some_and(|c| c.starts_with("text/event-stream"));
        let mut resp = resp;
        if event_stream {
            let mut parser = SseParser::new(MAX_BODY);
            loop {
                let chunk = match tokio::time::timeout(IDLE, resp.chunk()).await {
                    Ok(Ok(Some(b))) => b,
                    _ => break,
                };
                let Ok(items) = parser.push(&chunk) else {
                    return self.fail(
                        &server,
                        &message,
                        "the server sent a message that is too large",
                    );
                };
                for item in items {
                    if let SseItem::Data(d) = item {
                        self.deliver(&server, &d, &message);
                    }
                }
                if server.closed.load(Ordering::SeqCst) {
                    return;
                }
            }
        } else {
            match read_body(&mut resp, IDLE).await {
                Ok(body) => self.deliver(&server, &String::from_utf8_lossy(&body), &message),
                Err(text) => self.fail(&server, &message, text),
            }
        }
    }

    /// one JSON document (a message or a batch) to the page; `sent` is the request it answers
    fn deliver(&self, server: &Server, text: &str, sent: &Value) {
        let Ok(v) = serde_json::from_str::<Value>(text) else {
            server.sink.send(McpEvent::Invalid {
                reason: "not JSON".into(),
                bytes: text.len(),
            });
            return;
        };
        let list = match v {
            Value::Array(a) => a,
            one => vec![one],
        };
        // only the answer to `initialize` sets the version (a tool result may hold any JSON)
        let initialize = (sent.get("method").and_then(Value::as_str) == Some("initialize"))
            .then(|| sent.get("id"))
            .flatten()
            .filter(|id| !id.is_null());
        for m in list {
            // the version the server agreed to goes on every later request
            if let (Some(id), Some(p)) = (
                initialize,
                m.pointer("/result/protocolVersion")
                    .and_then(|p| p.as_str()),
            ) {
                let printable = p.bytes().all(|b| (0x21..=0x7e).contains(&b));
                if m.get("id") == Some(id) && p.len() <= 32 && printable {
                    *lock(&server.protocol) = Some(p.to_string());
                }
            }
            server.sink.send(McpEvent::Message {
                message: m,
                bytes: text.len(),
            });
        }
    }

    /// Disconnect: the session is closed on the server too (best effort).
    pub fn stop(&self, server_id: &str) {
        let Some(server) = lock(&self.servers).remove(server_id) else {
            return;
        };
        server.closed.store(true, Ordering::SeqCst);
        if let Some(s) = lock(&server.session).clone() {
            let mut req = self
                .client
                .delete(server.url.clone())
                .header("Mcp-Session-Id", s)
                .timeout(Duration::from_secs(5));
            for (k, v) in &server.headers {
                req = req.header(k.as_str(), v.as_str());
            }
            tauri::async_runtime::spawn(async move {
                let _ = req.send().await;
            });
        }
        server.sink.send(McpEvent::exit("stopped", "disconnected"));
    }

    pub fn stop_all(&self) {
        let ids: Vec<String> = lock(&self.servers).keys().cloned().collect();
        for id in ids {
            self.stop(&id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn addresses() {
        assert!(check_url("https://mcp.example.com/mcp").is_ok());
        assert!(check_url("http://127.0.0.1:3845/mcp").is_ok());
        assert!(check_url("http://localhost:3845/mcp").is_ok());
        assert!(check_url("http://mcp.example.com/mcp").is_err());
        assert!(check_url("https://user:pw@mcp.example.com/").is_err());
        assert!(check_url("file:///C:/x").is_err());
        assert!(check_url("ws://example.com").is_err());
    }

    #[test]
    fn headers() {
        assert!(is_header_name("Authorization"));
        assert!(is_header_name("X-Api-Key"));
        assert!(!is_header_name("Host"));
        assert!(!is_header_name("mcp-session-id"));
        assert!(!is_header_name("Bad Header"));
        assert!(is_header_value("Bearer abc"));
        assert!(!is_header_value("a\r\nX-Injected: 1"));
    }

    #[derive(Default)]
    struct Collect(Mutex<Vec<McpEvent>>);
    impl McpSink for Collect {
        fn send(&self, e: McpEvent) {
            lock(&self.0).push(e);
        }
    }

    #[derive(Default)]
    struct MemSecrets(Mutex<HashMap<String, String>>);
    impl Secrets for MemSecrets {
        fn read(&self, name: &str) -> Result<Option<String>, String> {
            Ok(lock(&self.0).get(name).cloned())
        }
        fn write(&self, name: &str, value: &str) -> Result<(), String> {
            lock(&self.0).insert(name.into(), value.into());
            Ok(())
        }
    }

    fn launch(url: &str) -> HttpLaunch {
        HttpLaunch {
            server_id: "srv".into(),
            url: url.into(),
            headers: BTreeMap::new(),
            secret_headers: BTreeMap::from([(
                "Authorization".to_string(),
                "mcp.srv.HDR_AUTHORIZATION".to_string(),
            )]),
            oauth: false,
        }
    }

    fn reason(sink: &Collect) -> Option<&'static str> {
        lock(&sink.0).iter().find_map(|e| match e {
            McpEvent::Exit { reason, .. } => Some(*reason),
            _ => None,
        })
    }

    #[test]
    fn a_header_secret_only_goes_to_the_address_it_was_first_sent_to() {
        let secrets = Arc::new(MemSecrets::default());
        lock(&secrets.0).insert("mcp.srv.HDR_AUTHORIZATION".into(), "Bearer k-123".into());
        let host = HttpHost::new(secrets.clone());
        // first use binds it
        let ok = Arc::new(Collect::default());
        host.start(launch("https://mcp.example.com/mcp"), ok.clone());
        assert!(reason(&ok).is_none(), "{:?}", lock(&ok.0));
        assert_eq!(
            lock(&secrets.0)
                .get("mcp.srv.HDR_AUTHORIZATION.origin")
                .map(String::as_str),
            Some("https://mcp.example.com")
        );
        host.stop("srv");
        // same origin, another path: fine
        let same = Arc::new(Collect::default());
        host.start(launch("https://mcp.example.com/other"), same.clone());
        assert!(!lock(&same.0).iter().any(|e| matches!(
            e,
            McpEvent::Exit {
                reason: "refused",
                ..
            }
        )));
        host.stop("srv");
        // another address: refused, nothing sent
        let other = Arc::new(Collect::default());
        host.start(launch("https://attacker.example.net/mcp"), other.clone());
        assert_eq!(reason(&other), Some("refused"));
        assert!(!lock(&other.0)
            .iter()
            .any(|e| matches!(e, McpEvent::Started { .. })));
    }

    #[test]
    fn only_the_initialize_answer_sets_the_protocol_version() {
        let sink = Arc::new(Collect::default());
        let server = Server {
            url: url::Url::parse("https://mcp.example.com/mcp").unwrap(),
            headers: vec![],
            oauth: false,
            session: Mutex::new(None),
            protocol: Mutex::new(None),
            sink: sink.clone(),
            closed: AtomicBool::new(false),
        };
        let host = HttpHost::new(Arc::new(MemSecrets::default()));
        let call = json!({"jsonrpc":"2.0","id":5,"method":"tools/call","params":{}});
        host.deliver(
            &server,
            r#"{"jsonrpc":"2.0","id":5,"result":{"protocolVersion":"evil\r\nX: 1"}}"#,
            &call,
        );
        host.deliver(
            &server,
            r#"{"jsonrpc":"2.0","id":5,"result":{"protocolVersion":"1999-01-01"}}"#,
            &call,
        );
        assert_eq!(*lock(&server.protocol), None);
        let init = json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{}});
        host.deliver(
            &server,
            r#"{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18"}}"#,
            &init,
        );
        assert_eq!(lock(&server.protocol).as_deref(), Some("2025-06-18"));
        assert_eq!(lock(&sink.0).len(), 3);
    }

    #[tokio::test]
    async fn an_answer_that_stops_arriving_is_cut_off() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        std::thread::spawn(move || {
            let (mut s, _) = listener.accept().unwrap();
            let mut buf = [0u8; 4096];
            let _ = s.read(&mut buf);
            let _ = s.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{\"jsonrpc\"");
            std::thread::sleep(Duration::from_secs(5));
        });
        let mut resp = reqwest::Client::new()
            .get(format!("http://{addr}/"))
            .send()
            .await
            .unwrap();
        let started = std::time::Instant::now();
        let r = read_body(&mut resp, Duration::from_millis(300)).await;
        assert_eq!(r, Err("the server stopped sending its answer"));
        assert!(started.elapsed() < Duration::from_secs(3));
    }
}
