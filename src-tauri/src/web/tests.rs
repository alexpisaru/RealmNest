use super::guard::{check_url, host_blocked_for_tests, is_public, GuardResolver, Policy};
use super::*;
use reqwest::dns::{Name, Resolve};
use std::io::{Read, Write};
use std::net::{IpAddr, TcpListener};
use std::str::FromStr;
use std::thread;

fn url(s: &str) -> Url {
    Url::parse(s).unwrap()
}

#[test]
fn private_and_special_addresses_are_not_public() {
    for ip in [
        "127.0.0.1",
        "127.5.6.7",
        "10.1.2.3",
        "172.16.0.1",
        "172.31.255.255",
        "192.168.1.1",
        "169.254.169.254",
        "100.64.0.1",
        "0.0.0.0",
        "224.0.0.1",
        "255.255.255.255",
        "192.0.2.10",
        "198.18.0.1",
        "203.0.113.5",
        "::1",
        "::",
        "fc00::1",
        "fd12:3456::1",
        "fe80::1",
        "ff02::1",
        "::ffff:127.0.0.1",
        "::ffff:192.168.0.1",
        "64:ff9b::a00:1",
        "2001:db8::1",
    ] {
        assert!(
            !is_public(IpAddr::from_str(ip).unwrap()),
            "{ip} must be blocked"
        );
    }
    for ip in [
        "8.8.8.8",
        "1.1.1.1",
        "93.184.216.34",
        "172.32.0.1",
        "2606:4700::1111",
        "::ffff:8.8.8.8",
        "64:ff9b::808:808",
    ] {
        assert!(is_public(IpAddr::from_str(ip).unwrap()), "{ip} is public");
    }
}

#[test]
fn urls_are_checked_before_any_request() {
    let p = Policy::PUBLIC;
    for ok in [
        "https://example.com/a?b=1",
        "http://example.org:8080/",
        "https://sub.example.co.uk:8443/x",
        "https://93.184.216.34/",
    ] {
        assert!(check_url(&url(ok), &p).is_ok(), "{ok}");
    }
    for bad in [
        "file:///C:/Windows/win.ini",
        "ftp://example.com/x",
        "javascript:alert(1)",
        "data:text/html,hi",
        "tauri://localhost/",
        "http://localhost/",
        "http://LOCALHOST./",
        "http://app.localhost/",
        "http://printer.local/",
        "http://metadata.google.internal/computeMetadata/v1/",
        "http://intranet/",
        "http://127.0.0.1/",
        "http://2130706433/",
        "http://0x7f.0.0.1/",
        "http://[::1]/",
        "http://[::ffff:127.0.0.1]/",
        "http://169.254.169.254/latest/meta-data/",
        "http://192.168.0.10/admin",
        "http://10.0.0.1:8080/",
        "https://user:pass@example.com/",
        "https://example.com:22/",
    ] {
        assert!(check_url(&url(bad), &p).is_err(), "{bad} must be blocked");
    }
    assert!(host_blocked_for_tests("router.home.arpa"));
}

#[tokio::test]
async fn names_that_resolve_to_private_addresses_are_refused() {
    let r = GuardResolver {
        policy: Policy::PUBLIC,
    };
    let err = match r.resolve(Name::from_str("localhost").unwrap()).await {
        Ok(_) => panic!("localhost must not resolve"),
        Err(e) => e.to_string(),
    };
    assert!(err.contains(super::guard::BLOCKED_MARK), "{err}");
}

/// a one-off HTTP server on 127.0.0.1 answering each connection with `respond(path)`
fn server(n: usize, respond: impl Fn(&str) -> Vec<u8> + Send + 'static) -> u16 {
    let l = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = l.local_addr().unwrap().port();
    thread::spawn(move || {
        for _ in 0..n {
            let Ok((mut s, _)) = l.accept() else { return };
            let mut buf = [0u8; 4096];
            let n = s.read(&mut buf).unwrap_or(0);
            let req = String::from_utf8_lossy(&buf[..n]).to_string();
            let path = req.split_whitespace().nth(1).unwrap_or("/").to_string();
            let _ = s.write_all(&respond(&path));
        }
    });
    port
}

fn ok(ct: &str, body: &str) -> Vec<u8> {
    format!("HTTP/1.1 200 OK\r\nContent-Type: {ct}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).into_bytes()
}

fn test_policy(port: u16) -> Policy {
    Policy {
        test_loopback_port: Some(port),
    }
}

#[tokio::test]
async fn reads_a_page_and_reports_what_it_got() {
    let port = server(1, |_| {
        ok(
            "text/html; charset=utf-8",
            "<html><title>Hi</title><p>RealmNest web</p></html>",
        )
    });
    let r = fetch(
        &format!("http://127.0.0.1:{port}/a"),
        test_policy(port),
        None,
    )
    .await
    .unwrap();
    assert_eq!(r.status, 200);
    assert_eq!(r.content_type.as_deref(), Some("text/html; charset=utf-8"));
    assert_eq!(
        crate::skills::b64_decode(&r.body).unwrap(),
        b"<html><title>Hi</title><p>RealmNest web</p></html>"
    );
    assert!(r.redirects.is_empty());
}

#[tokio::test]
async fn a_redirect_to_a_private_address_is_blocked_before_it_is_followed() {
    let port = server(1, |_| {
        b"HTTP/1.1 302 Found\r\nLocation: http://10.0.0.1/admin\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_vec()
    });
    let e = fetch(
        &format!("http://127.0.0.1:{port}/go"),
        test_policy(port),
        None,
    )
    .await
    .unwrap_err();
    assert_eq!(e.code, "FETCH_BLOCKED_URL");
    assert!(e.message.contains("redirect blocked"), "{}", e.message);
    let port = server(1, |_| {
        b"HTTP/1.1 301 Moved\r\nLocation: file:///C:/Windows/win.ini\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_vec()
    });
    assert_eq!(
        fetch(
            &format!("http://127.0.0.1:{port}/go"),
            test_policy(port),
            None
        )
        .await
        .unwrap_err()
        .code,
        "FETCH_BLOCKED_URL"
    );
}

#[tokio::test]
async fn redirects_are_followed_and_limited() {
    let port = server(2, |path| {
        if path == "/start" {
            b"HTTP/1.1 302 Found\r\nLocation: /final\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_vec()
        } else {
            ok("text/plain", "landed")
        }
    });
    let r = fetch(
        &format!("http://127.0.0.1:{port}/start"),
        test_policy(port),
        None,
    )
    .await
    .unwrap();
    assert_eq!(r.redirects, vec![format!("http://127.0.0.1:{port}/final")]);
    assert!(r.final_url.ends_with("/final"));
    let port = server(10, |_| {
        b"HTTP/1.1 302 Found\r\nLocation: /again\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            .to_vec()
    });
    assert_eq!(
        fetch(
            &format!("http://127.0.0.1:{port}/again"),
            test_policy(port),
            None
        )
        .await
        .unwrap_err()
        .code,
        "FETCH_TOO_MANY_REDIRECTS"
    );
}

#[tokio::test]
async fn size_limits_hold_with_and_without_content_length() {
    let port = server(1, |_| {
        format!("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", 50_000_000).into_bytes()
    });
    assert_eq!(
        fetch(
            &format!("http://127.0.0.1:{port}/"),
            test_policy(port),
            None
        )
        .await
        .unwrap_err()
        .code,
        "FETCH_TOO_LARGE"
    );
    // no length announced: the stream is cut at the limit
    let port = server(1, |_| {
        let mut v =
            b"HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\n".to_vec();
        v.extend(std::iter::repeat_n(b'x', 300_000));
        v
    });
    let e = fetch(
        &format!("http://127.0.0.1:{port}/"),
        test_policy(port),
        Some(100_000),
    )
    .await
    .unwrap_err();
    assert_eq!(e.code, "FETCH_TOO_LARGE");
}

#[tokio::test]
async fn a_silent_server_times_out_cleanly() {
    let l = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = l.local_addr().unwrap().port();
    thread::spawn(move || {
        let _held = l.accept();
        thread::sleep(std::time::Duration::from_secs(5));
    });
    let started = std::time::Instant::now();
    let e = fetch_with(
        &format!("http://127.0.0.1:{port}/slow"),
        test_policy(port),
        None,
        Duration::from_secs(1),
    )
    .await
    .unwrap_err();
    assert_eq!(e.code, "FETCH_TIMEOUT");
    assert!(started.elapsed() < Duration::from_secs(4));
}

#[tokio::test]
async fn files_are_not_downloaded_and_errors_are_named() {
    let port = server(1, |_| {
        b"HTTP/1.1 200 OK\r\nContent-Type: application/zip\r\nContent-Length: 2000000000\r\nConnection: close\r\n\r\n".to_vec()
    });
    let e = fetch(
        &format!("http://127.0.0.1:{port}/big.zip"),
        test_policy(port),
        None,
    )
    .await
    .unwrap_err();
    assert_eq!(
        (e.code.as_str(), e.content_type.as_deref(), e.content_length),
        (
            "FETCH_UNSUPPORTED_CONTENT",
            Some("application/zip"),
            Some(2_000_000_000)
        )
    );
    for (status, code) in [
        (404, "FETCH_NOT_FOUND"),
        (403, "FETCH_ACCESS_DENIED"),
        (429, "FETCH_RATE_LIMITED"),
        (500, "FETCH_HTTP_ERROR"),
    ] {
        let port = server(1, move |_| {
            format!("HTTP/1.1 {status} X\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                .into_bytes()
        });
        let e = fetch(
            &format!("http://127.0.0.1:{port}/"),
            test_policy(port),
            None,
        )
        .await
        .unwrap_err();
        assert_eq!((e.code.as_str(), e.status), (code, Some(status)));
    }
}

#[tokio::test]
async fn the_test_policy_never_opens_other_local_ports() {
    // allowed: the test server's own port only
    let e = fetch("http://127.0.0.1:9/", test_policy(65000), None)
        .await
        .unwrap_err();
    assert_eq!(e.code, "FETCH_BLOCKED_URL");
    assert_eq!(
        fetch("http://127.0.0.1/", Policy::PUBLIC, None)
            .await
            .unwrap_err()
            .code,
        "FETCH_BLOCKED_URL"
    );
}

#[tokio::test]
async fn pictures_only_raster_and_checked_by_their_bytes() {
    let png = |ct: &'static str, body: &'static [u8]| {
        let mut r = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: {ct}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            body.len()
        )
        .into_bytes();
        r.extend_from_slice(body);
        r
    };
    let port = server(1, move |_| png("image/png", b"\x89PNG\r\n\x1a\n0000rest"));
    let r = fetch_kind(
        &format!("http://127.0.0.1:{port}/a.png"),
        test_policy(port),
        None,
        TIMEOUT,
        Want::Image,
    )
    .await
    .unwrap();
    assert_eq!(r.content_type.as_deref(), Some("image/png"));
    // SVG can hold script: never
    let port = server(1, move |_| png("image/svg+xml", b"<svg onload='x'/>"));
    let e = fetch_kind(
        &format!("http://127.0.0.1:{port}/a.svg"),
        test_policy(port),
        None,
        TIMEOUT,
        Want::Image,
    )
    .await
    .unwrap_err();
    assert_eq!(e.code, "FETCH_UNSUPPORTED_CONTENT");
    // a page that says it is a picture
    let port = server(1, move |_| png("image/jpeg", b"<html>not a picture</html>"));
    let e = fetch_kind(
        &format!("http://127.0.0.1:{port}/a.jpg"),
        test_policy(port),
        None,
        TIMEOUT,
        Want::Image,
    )
    .await
    .unwrap_err();
    assert_eq!(e.code, "FETCH_UNSUPPORTED_CONTENT");
    // and a page is not fetched as a picture, nor a picture as a page
    let port = server(1, |_| ok("text/html", "<p>hi</p>"));
    assert!(fetch_kind(
        &format!("http://127.0.0.1:{port}/"),
        test_policy(port),
        None,
        TIMEOUT,
        Want::Image
    )
    .await
    .is_err());
    assert!(picture_bytes(b"RIFF\0\0\0\0WEBPVP8 "));
    assert!(!picture_bytes(b"RIFF\0\0\0\0WAVEfmt "));
}
