//! A small HTTP proxy on 127.0.0.1 for the hidden page reader (render.rs).
//!
//! WebView2 resolves names itself, so a public name that resolves to a private address (DNS
//! rebinding) would reach this computer or the local network. The reader is started with
//! `--proxy-server` pointing here (loopback not bypassed), so every connection it makes
//! (pages, sub-resources, workers, WebSockets) comes through this proxy, which resolves the
//! destination itself, refuses it unless the URL rules (guard::check_url) pass and EVERY
//! address is public, and connects to exactly a checked address:
//!
//! - `CONNECT host:port` (https, wss): checked, then bytes are relayed both ways;
//! - plain http (absolute-form request): checked, sent on in origin form with
//!   `Connection: close`; the answer goes back marked `Connection: close` too, so one proxy
//!   connection carries one request and can never be reused for a host that was not checked;
//! - anything else, or a refused destination: 403.

use super::guard::{check_url, Policy};
use reqwest::Url;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Semaphore;

const MAX_HEAD: usize = 16 * 1024;
const MAX_RESPONSE_HEAD: usize = 64 * 1024;
const HEAD_TIMEOUT: Duration = Duration::from_secs(10);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const RESPONSE_TIMEOUT: Duration = Duration::from_secs(30);
/// no connection of the reader lives longer (a page is read in well under a minute)
const MAX_LIFE: Duration = Duration::from_secs(300);
const MAX_CONNECTIONS: usize = 64;
const DENIED: &[u8] = b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";

/// Start the proxy (on the current tokio runtime); its address.
pub async fn start(policy: Policy) -> std::io::Result<SocketAddr> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let addr = listener.local_addr()?;
    let slots = Arc::new(Semaphore::new(MAX_CONNECTIONS));
    tokio::spawn(async move {
        loop {
            let (sock, peer) = match listener.accept().await {
                Ok(c) => c,
                Err(_) => {
                    tokio::time::sleep(Duration::from_millis(50)).await;
                    continue;
                }
            };
            if !peer.ip().is_loopback() {
                continue;
            }
            let Ok(slot) = slots.clone().acquire_owned().await else {
                return;
            };
            tokio::spawn(async move {
                let _ = tokio::time::timeout(MAX_LIFE, handle(sock, policy)).await;
                drop(slot);
            });
        }
    });
    Ok(addr)
}

fn find(hay: &[u8], needle: &[u8]) -> Option<usize> {
    hay.windows(needle.len()).position(|w| w == needle)
}

/// The head (up to and including the blank line) and whatever was read after it.
async fn read_head(s: &mut (impl AsyncRead + Unpin), max: usize) -> Option<(Vec<u8>, Vec<u8>)> {
    let mut buf = Vec::new();
    let mut tmp = [0u8; 4096];
    loop {
        let n = s.read(&mut tmp).await.ok()?;
        if n == 0 {
            return None;
        }
        buf.extend_from_slice(&tmp[..n]);
        if let Some(i) = find(&buf, b"\r\n\r\n") {
            let rest = buf.split_off(i + 4);
            return Some((buf, rest));
        }
        if buf.len() > max {
            return None;
        }
    }
}

fn header_name(line: &str) -> String {
    line.split(':')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase()
}

/// headers that describe one connection, not the request: never passed on
fn hop_by_hop(line: &str) -> bool {
    matches!(
        header_name(line).as_str(),
        "connection" | "proxy-connection" | "keep-alive" | "proxy-authorization" | "te" | "upgrade"
    )
}

/// `host:port` of a CONNECT, as an https URL the guard can judge (nothing but an authority)
pub fn connect_target(target: &str) -> Option<Url> {
    if target.is_empty() || target.contains(['/', '@', '?', '#', '\\']) {
        return None;
    }
    // the port is required (the URL would hide :443 as the https default)
    let (_, port) = target.rsplit_once(':')?;
    port.parse::<u16>().ok()?;
    Url::parse(&format!("https://{target}/")).ok()
}

/// Resolve and connect, only when the URL passes the guard and every address is public.
async fn open(url: &Url, policy: &Policy) -> Option<TcpStream> {
    check_url(url, policy).ok()?;
    let port = url.port_or_known_default()?;
    let host = url
        .host_str()?
        .trim_start_matches('[')
        .trim_end_matches(']')
        .to_string();
    let addrs: Vec<SocketAddr> = tokio::time::timeout(
        CONNECT_TIMEOUT,
        tokio::net::lookup_host((host.as_str(), port)),
    )
    .await
    .ok()?
    .ok()?
    .collect();
    if addrs.is_empty() || addrs.iter().any(|a| !policy.ip_allowed(a.ip(), port)) {
        return None;
    }
    for a in addrs {
        if let Ok(Ok(s)) = tokio::time::timeout(CONNECT_TIMEOUT, TcpStream::connect(a)).await {
            return Some(s);
        }
    }
    None
}

async fn deny(client: &mut TcpStream) {
    let _ = client.write_all(DENIED).await;
    let _ = client.shutdown().await;
}

async fn handle(mut client: TcpStream, policy: Policy) {
    let Ok(Some((head, rest))) =
        tokio::time::timeout(HEAD_TIMEOUT, read_head(&mut client, MAX_HEAD)).await
    else {
        return;
    };
    let Ok(text) = std::str::from_utf8(&head) else {
        return deny(&mut client).await;
    };
    let mut lines = text.split("\r\n");
    let mut words = lines.next().unwrap_or("").split(' ');
    let (Some(method), Some(target), Some(version), None) =
        (words.next(), words.next(), words.next(), words.next())
    else {
        return deny(&mut client).await;
    };
    if !version.starts_with("HTTP/1.") {
        return deny(&mut client).await;
    }

    if method.eq_ignore_ascii_case("CONNECT") {
        let Some(url) = connect_target(target) else {
            return deny(&mut client).await;
        };
        let Some(mut upstream) = open(&url, &policy).await else {
            return deny(&mut client).await;
        };
        if client
            .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            .await
            .is_err()
        {
            return;
        }
        if !rest.is_empty() && upstream.write_all(&rest).await.is_err() {
            return;
        }
        let _ = tokio::io::copy_bidirectional(&mut client, &mut upstream).await;
        return;
    }

    // plain http: one request with a known body length, absolute form
    let Ok(url) = Url::parse(target) else {
        return deny(&mut client).await;
    };
    let headers: Vec<&str> = lines.filter(|l| !l.is_empty()).collect();
    if url.scheme() != "http"
        || headers
            .iter()
            .any(|h| header_name(h) == "transfer-encoding")
    {
        return deny(&mut client).await;
    }
    let body_len = match headers
        .iter()
        .find(|h| header_name(h) == "content-length")
        .map(|h| h.split_once(':').map(|(_, v)| v.trim()).unwrap_or(""))
    {
        None => 0u64,
        Some(v) => match v.parse::<u64>() {
            Ok(n) => n,
            Err(_) => return deny(&mut client).await,
        },
    };
    let Some(mut upstream) = open(&url, &policy).await else {
        return deny(&mut client).await;
    };
    let path = &url[url::Position::BeforePath..url::Position::AfterQuery];
    let mut out = format!("{method} {path} {version}\r\n");
    for h in headers.iter().filter(|h| !hop_by_hop(h)) {
        out.push_str(h);
        out.push_str("\r\n");
    }
    out.push_str("Connection: close\r\n\r\n");
    if upstream.write_all(out.as_bytes()).await.is_err() {
        return;
    }
    // the body: exactly its length; nothing after it is passed on from this connection
    let first = rest.len().min(body_len as usize);
    if upstream.write_all(&rest[..first]).await.is_err() {
        return;
    }
    let remaining = body_len - first as u64;
    if remaining > 0
        && tokio::io::copy(&mut (&mut client).take(remaining), &mut upstream)
            .await
            .is_err()
    {
        return;
    }
    // the answer, marked to close the connection, then relayed until the server ends it
    let Ok(Some((head, rest))) = tokio::time::timeout(
        RESPONSE_TIMEOUT,
        read_head(&mut upstream, MAX_RESPONSE_HEAD),
    )
    .await
    else {
        return;
    };
    let Ok(text) = std::str::from_utf8(&head) else {
        return;
    };
    let mut out = String::new();
    for (i, line) in text.split("\r\n").filter(|l| !l.is_empty()).enumerate() {
        if i > 0 && hop_by_hop(line) {
            continue;
        }
        out.push_str(line);
        out.push_str("\r\n");
    }
    out.push_str("Connection: close\r\nProxy-Connection: close\r\n\r\n");
    if client.write_all(out.as_bytes()).await.is_err() || client.write_all(&rest).await.is_err() {
        return;
    }
    let _ = tokio::io::copy(&mut upstream, &mut client).await;
    let _ = client.shutdown().await;
}

#[cfg(test)]
mod tests {
    use super::*;

    /// a loopback web server: answers every request with "ok" (keep-alive), reports the head
    async fn origin() -> (u16, tokio::sync::mpsc::UnboundedReceiver<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
        tokio::spawn(async move {
            while let Ok((mut s, _)) = listener.accept().await {
                let tx = tx.clone();
                tokio::spawn(async move {
                    if let Some((head, _)) = read_head(&mut s, MAX_HEAD).await {
                        let _ = tx.send(String::from_utf8_lossy(&head).to_string());
                        let _ = s
                            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: keep-alive\r\nKeep-Alive: timeout=5\r\n\r\nok")
                            .await;
                    }
                });
            }
        });
        (port, rx)
    }

    async fn ask(proxy: SocketAddr, request: &str) -> String {
        let mut s = TcpStream::connect(proxy).await.unwrap();
        s.write_all(request.as_bytes()).await.unwrap();
        let mut out = Vec::new();
        let _ = tokio::time::timeout(Duration::from_secs(5), s.read_to_end(&mut out)).await;
        String::from_utf8_lossy(&out).to_string()
    }

    #[tokio::test]
    async fn only_checked_public_destinations_are_reached() {
        let (port, mut seen) = origin().await;
        let proxy = start(Policy {
            test_loopback_port: Some(port),
        })
        .await
        .unwrap();

        // plain http: sent on in origin form, one request per connection both ways
        let r = ask(
            proxy,
            &format!("GET http://127.0.0.1:{port}/page?q=1 HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nProxy-Connection: keep-alive\r\n\r\n"),
        )
        .await;
        assert!(r.starts_with("HTTP/1.1 200 OK"), "{r}");
        assert!(r.ends_with("ok") && r.contains("Connection: close"), "{r}");
        assert!(!r.contains("keep-alive"), "{r}");
        let head = seen.recv().await.unwrap();
        assert!(head.starts_with("GET /page?q=1 HTTP/1.1\r\n"), "{head}");
        assert!(head.contains("Connection: close") && !head.contains("Proxy-Connection"));

        // CONNECT (https, wss): a tunnel to the checked address
        let mut s = TcpStream::connect(proxy).await.unwrap();
        s.write_all(
            format!("CONNECT 127.0.0.1:{port} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n\r\n")
                .as_bytes(),
        )
        .await
        .unwrap();
        let (head, _) = read_head(&mut s, MAX_HEAD).await.unwrap();
        assert!(String::from_utf8_lossy(&head).starts_with("HTTP/1.1 200"));
        s.write_all(b"GET /t HTTP/1.1\r\nHost: x\r\n\r\n")
            .await
            .unwrap();
        let mut buf = vec![0u8; 512];
        let n = tokio::time::timeout(Duration::from_secs(5), s.read(&mut buf))
            .await
            .unwrap()
            .unwrap();
        assert!(String::from_utf8_lossy(&buf[..n]).ends_with("ok"));

        // everything private, local or odd: refused
        for request in [
            format!(
                "CONNECT 127.0.0.1:{} HTTP/1.1\r\n\r\n",
                port.wrapping_add(1)
            ),
            format!("CONNECT localhost:{port} HTTP/1.1\r\n\r\n"),
            "CONNECT 169.254.169.254:443 HTTP/1.1\r\n\r\n".into(),
            "CONNECT 10.0.0.1:443 HTTP/1.1\r\n\r\n".into(),
            "CONNECT [::1]:443 HTTP/1.1\r\n\r\n".into(),
            "CONNECT router.local:443 HTTP/1.1\r\n\r\n".into(),
            "CONNECT example.com:22 HTTP/1.1\r\n\r\n".into(),
            "GET http://192.168.1.1/ HTTP/1.1\r\n\r\n".into(),
            "GET http://intranet/ HTTP/1.1\r\n\r\n".into(),
            "GET /relative HTTP/1.1\r\n\r\n".into(),
            "GET file:///C:/Windows/win.ini HTTP/1.1\r\n\r\n".into(),
            format!("POST http://127.0.0.1:{port}/ HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n"),
        ] {
            let r = ask(proxy, &request).await;
            assert!(r.starts_with("HTTP/1.1 403"), "{request} -> {r}");
        }
    }

    #[test]
    fn connect_targets_are_authorities_only() {
        assert!(connect_target("example.com:443").is_some());
        assert!(connect_target("[2001:db8::1]:443").is_some());
        assert!(connect_target("example.com").is_none());
        assert!(connect_target("[::1]").is_none());
        assert!(connect_target("user@example.com:443").is_none());
        assert!(connect_target("example.com:443/x").is_none());
        assert!(connect_target("").is_none());
    }
}
