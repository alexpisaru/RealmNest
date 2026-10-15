//! Signing in to an online MCP server with OAuth (the MCP authorization flow):
//! discovery (protected-resource metadata, then the authorization server's metadata),
//! dynamic client registration, PKCE (S256) in the user's browser, the code received on
//! a one-time listener on 127.0.0.1, the token exchange, and refresh later.
//!
//! Tokens never reach the page: they live in the OS credential store under
//! `mcp.<server id>.OAUTH*` (split in pieces, Windows limits one entry's size) and in
//! memory here.
//!
//! Every address discovery hands back is untrusted: https only (http only when the MCP
//! server itself runs on this computer), public hosts only unless the MCP server is local
//! (checked again at DNS resolution), no redirects, answers size-capped. The resource the
//! metadata names must be the MCP server's own address, and an authorization server's
//! metadata must name the issuer it was fetched for.

use super::lock;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const LOGIN_TIMEOUT: Duration = Duration::from_secs(300);
const CHUNK: usize = 1200;
/// a metadata, registration or token answer
const MAX_ANSWER: usize = 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tokens {
    pub client_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_secret: Option<String>,
    pub token_endpoint: String,
    pub resource: String,
    pub access_token: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    /// seconds since the epoch
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<u64>,
}

static CACHE: Mutex<Option<HashMap<String, Tokens>>> = Mutex::new(None);
/// one refresh at a time per server: a rotating refresh token works only once
type Gate = Arc<tokio::sync::Mutex<()>>;
static REFRESHING: Mutex<Option<HashMap<String, Gate>>> = Mutex::new(None);

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn key(server_id: &str) -> String {
    format!("mcp.{server_id}.OAUTH")
}

/// a long value in several credential entries: `<key>` holds the number of pieces
fn put_long(name: &str, value: &str) -> Result<(), String> {
    let pieces: Vec<String> = value
        .chars()
        .collect::<Vec<_>>()
        .chunks(CHUNK)
        .map(|c| c.iter().collect())
        .collect();
    for (i, p) in pieces.iter().enumerate() {
        crate::secrets::set(&format!("{name}.{i}"), p)?;
    }
    crate::secrets::set(name, &pieces.len().to_string())
}

fn get_long(name: &str) -> Option<String> {
    let n: usize = crate::secrets::read(name).ok()??.parse().ok()?;
    let mut out = String::new();
    for i in 0..n.min(64) {
        out.push_str(&crate::secrets::read(&format!("{name}.{i}")).ok()??);
    }
    Some(out)
}

fn del_long(name: &str) {
    if let Some(n) = crate::secrets::read(name)
        .ok()
        .flatten()
        .and_then(|n| n.parse::<usize>().ok())
    {
        for i in 0..n.min(64) {
            let _ = crate::secrets::delete(&format!("{name}.{i}"));
        }
    }
    let _ = crate::secrets::delete(name);
}

fn save(server_id: &str, t: &Tokens) -> Result<(), String> {
    put_long(
        &key(server_id),
        &serde_json::to_string(t).map_err(|e| e.to_string())?,
    )?;
    lock(&CACHE)
        .get_or_insert_with(HashMap::new)
        .insert(server_id.to_string(), t.clone());
    Ok(())
}

/// the stored sign-in, if any
pub fn stored(server_id: &str) -> Option<Tokens> {
    if let Some(t) = lock(&CACHE).as_ref().and_then(|c| c.get(server_id)) {
        return Some(t.clone());
    }
    let t: Tokens = serde_json::from_str(&get_long(&key(server_id))?).ok()?;
    lock(&CACHE)
        .get_or_insert_with(HashMap::new)
        .insert(server_id.to_string(), t.clone());
    Some(t)
}

pub fn sign_out(server_id: &str) {
    del_long(&key(server_id));
    if let Some(c) = lock(&CACHE).as_mut() {
        c.remove(server_id);
    }
}

/// Was this sign-in made for this server address? (the token is sent nowhere else)
pub fn issued_for(t: &Tokens, mcp_url: &url::Url) -> bool {
    url::Url::parse(&t.resource)
        .map(|r| r.origin() == mcp_url.origin())
        .unwrap_or(false)
}

fn is_loopback_host(u: &url::Url) -> bool {
    match u.host() {
        Some(url::Host::Domain(d)) => d.eq_ignore_ascii_case("localhost"),
        Some(url::Host::Ipv4(ip)) => ip.is_loopback(),
        Some(url::Host::Ipv6(ip)) => ip.is_loopback(),
        None => false,
    }
}

/// An address the sign-in metadata gave: https, or http on this computer only when the MCP
/// server is on this computer too; no credentials; a public host unless the MCP server is local.
pub fn check_endpoint(raw: &str, local_server: bool) -> Result<url::Url, String> {
    let u = url::Url::parse(raw)
        .map_err(|_| "the sign-in server gave an invalid address".to_string())?;
    if !u.username().is_empty() || u.password().is_some() {
        return Err("the sign-in server gave an address with credentials".into());
    }
    match u.scheme() {
        "https" => {}
        "http" if local_server && is_loopback_host(&u) => {}
        _ => return Err("the sign-in server does not use https".into()),
    }
    if !local_server && !crate::web::guard::host_is_public(&u) {
        return Err("the sign-in server is on a private or local address".into());
    }
    Ok(u)
}

/// RFC 9728: the protected resource the metadata describes must be this MCP server
/// (same origin, and its path a prefix of the server's path).
pub fn resource_matches(resource: &str, mcp_url: &url::Url) -> bool {
    let Ok(r) = url::Url::parse(resource) else {
        return false;
    };
    if r.origin() != mcp_url.origin() || r.username() != "" || r.password().is_some() {
        return false;
    }
    let prefix = r.path().trim_end_matches('/');
    let path = mcp_url.path();
    prefix.is_empty() || path == prefix || path.starts_with(&format!("{prefix}/"))
}

/// RFC 8414 §3.3: the metadata names the issuer whose address it was fetched for.
pub fn issuer_matches(said: Option<&str>, issuer: &url::Url) -> bool {
    let norm = |s: &str| s.trim_end_matches('/').to_string();
    said.is_some_and(|s| norm(s) == norm(issuer.as_str()))
}

/// No redirects, time-limited, and (unless the MCP server is local) public addresses only,
/// checked again when names resolve.
fn http_client(local_server: bool) -> Result<reqwest::Client, String> {
    let mut b = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .no_proxy()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(30))
        .user_agent("RealmNest");
    if !local_server {
        b = b.dns_resolver(Arc::new(crate::web::guard::GuardResolver {
            policy: crate::web::guard::Policy::PUBLIC,
        }));
    }
    b.build()
        .map_err(|_| "the sign-in could not start (no HTTP client)".to_string())
}

/// a JSON answer, at most MAX_ANSWER bytes
async fn json_capped(mut r: reqwest::Response) -> Option<Value> {
    if r.content_length().is_some_and(|n| n > MAX_ANSWER as u64) {
        return None;
    }
    let mut body = Vec::new();
    while let Some(c) = r.chunk().await.ok()? {
        body.extend_from_slice(&c);
        if body.len() > MAX_ANSWER {
            return None;
        }
    }
    serde_json::from_slice(&body).ok()
}

fn form(pairs: &[(&str, &str)]) -> String {
    let mut s = url::form_urlencoded::Serializer::new(String::new());
    for (k, v) in pairs {
        s.append_pair(k, v);
    }
    s.finish()
}

async fn token_request(
    client: &reqwest::Client,
    endpoint: &url::Url,
    body: String,
) -> Result<Value, String> {
    let r = client
        .post(endpoint.clone())
        .header("Content-Type", "application/x-www-form-urlencoded")
        .header("Accept", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|_| "the sign-in server could not be reached".to_string())?;
    let status = r.status().as_u16();
    let v: Value = json_capped(r)
        .await
        .ok_or_else(|| "the sign-in server's answer could not be read".to_string())?;
    if status != 200 || v["access_token"].as_str().is_none() {
        let said = v["error_description"]
            .as_str()
            .or(v["error"].as_str())
            .unwrap_or("refused");
        return Err(format!(
            "the sign-in server refused: {}",
            said.chars().take(160).collect::<String>()
        ));
    }
    Ok(v)
}

fn apply(t: &mut Tokens, v: &Value) {
    if let Some(a) = v["access_token"].as_str() {
        t.access_token = a.to_string();
    }
    if let Some(r) = v["refresh_token"].as_str() {
        t.refresh_token = Some(r.to_string());
    }
    t.expires_at = v["expires_in"].as_u64().map(|s| now() + s);
}

fn fresh(t: &Tokens) -> bool {
    t.expires_at.map(|e| e > now() + 30).unwrap_or(true)
}

fn refresh_gate(server_id: &str) -> Gate {
    lock(&REFRESHING)
        .get_or_insert_with(HashMap::new)
        .entry(server_id.to_string())
        .or_default()
        .clone()
}

/// A valid access token: the stored one, refreshed when it expires (or when `force`).
pub async fn access_token(server_id: &str, force: bool) -> Result<String, String> {
    let seen = stored(server_id).ok_or("sign in to this server first")?;
    if fresh(&seen) && !force {
        return Ok(seen.access_token);
    }
    // one refresh at a time; whoever waited uses the token the first one got
    let gate = refresh_gate(server_id);
    let _turn = gate.lock().await;
    let mut t = stored(server_id).ok_or("sign in to this server first")?;
    if t.access_token != seen.access_token && fresh(&t) {
        return Ok(t.access_token);
    }
    let refresh = t
        .refresh_token
        .clone()
        .ok_or("the sign-in expired; sign in again")?;
    let local = url::Url::parse(&t.resource)
        .map(|u| is_loopback_host(&u))
        .unwrap_or(false);
    let endpoint = check_endpoint(&t.token_endpoint, local)
        .map_err(|_| "the sign-in expired; sign in again".to_string())?;
    let mut pairs = vec![
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh.as_str()),
        ("client_id", t.client_id.as_str()),
        ("resource", t.resource.as_str()),
    ];
    if let Some(s) = &t.client_secret {
        pairs.push(("client_secret", s.as_str()));
    }
    let client = http_client(local)?;
    let v = token_request(&client, &endpoint, form(&pairs))
        .await
        .map_err(|_| "the sign-in expired; sign in again".to_string())?;
    apply(&mut t, &v);
    save(server_id, &t)?;
    Ok(t.access_token)
}

async fn get_json(client: &reqwest::Client, url: &str) -> Option<Value> {
    let r = client
        .get(url)
        .header("Accept", "application/json")
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .ok()?;
    if r.status().as_u16() != 200 {
        return None;
    }
    json_capped(r).await
}

fn well_known(base: &url::Url, name: &str) -> Vec<String> {
    let origin = base.origin().ascii_serialization();
    let path = base.path().trim_end_matches('/');
    let mut v = Vec::new();
    if !path.is_empty() {
        v.push(format!("{origin}/.well-known/{name}{path}"));
    }
    v.push(format!("{origin}/.well-known/{name}"));
    v
}

#[derive(Debug)]
pub struct Endpoints {
    pub authorization: url::Url,
    pub token: url::Url,
    pub registration: Option<url::Url>,
    pub scopes: Option<String>,
    pub resource: String,
}

fn scope_list(v: &Value) -> Option<String> {
    v.as_array()
        .map(|a| {
            a.iter()
                .filter_map(|s| s.as_str())
                .collect::<Vec<_>>()
                .join(" ")
        })
        .filter(|s| !s.is_empty())
}

/// Where to sign in for this MCP server (RFC 9728, then RFC 8414 / OpenID discovery).
async fn discover(
    client: &reqwest::Client,
    mcp_url: &url::Url,
    local: bool,
) -> Result<Endpoints, String> {
    let mut issuer =
        url::Url::parse(&mcp_url.origin().ascii_serialization()).map_err(|e| e.to_string())?;
    let mut scopes = None;
    let mut resource = mcp_url.to_string();
    for u in well_known(mcp_url, "oauth-protected-resource") {
        if let Some(m) = get_json(client, &u).await {
            if let Some(r) = m["resource"].as_str() {
                // a token for another service must never be asked for (and then sent here)
                if !resource_matches(r, mcp_url) {
                    return Err(
                        "the server's sign-in information names another address (resource)".into(),
                    );
                }
                resource = r.to_string();
            }
            if let Some(a) = m["authorization_servers"][0].as_str() {
                issuer = check_endpoint(a, local)?;
            }
            scopes = scope_list(&m["scopes_supported"]);
            break;
        }
    }
    let mut meta = None;
    'names: for name in ["oauth-authorization-server", "openid-configuration"] {
        for u in well_known(&issuer, name) {
            if let Some(m) = get_json(client, &u).await {
                if !issuer_matches(m["issuer"].as_str(), &issuer) {
                    return Err(
                        "the sign-in server's information does not match its address (issuer)"
                            .into(),
                    );
                }
                meta = Some(m);
                break 'names;
            }
        }
    }
    let origin = issuer.origin().ascii_serialization();
    let m = meta.unwrap_or(Value::Null);
    let pick = |k: &str, fallback: &str| {
        m[k].as_str()
            .map(String::from)
            .unwrap_or_else(|| format!("{origin}{fallback}"))
    };
    let registration = m["registration_endpoint"]
        .as_str()
        .map(String::from)
        .or_else(|| m.is_null().then(|| format!("{origin}/register")));
    Ok(Endpoints {
        authorization: check_endpoint(&pick("authorization_endpoint", "/authorize"), local)?,
        token: check_endpoint(&pick("token_endpoint", "/token"), local)?,
        registration: registration
            .map(|r| check_endpoint(&r, local))
            .transpose()?,
        scopes: scopes.or_else(|| scope_list(&m["scopes_supported"])),
        resource,
    })
}

fn random(n: usize) -> Result<String, String> {
    let mut b = vec![0u8; n];
    getrandom::getrandom(&mut b).map_err(|_| "no secure random source".to_string())?;
    Ok(URL_SAFE_NO_PAD.encode(b))
}

pub fn challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

/// `GET /callback?code=…&state=…` → (code, state)
pub fn parse_callback(
    request_line: &str,
) -> Option<(Option<String>, Option<String>, Option<String>)> {
    let target = request_line.split_whitespace().nth(1)?;
    let u = url::Url::parse(&format!("http://127.0.0.1{target}")).ok()?;
    if u.path() != "/callback" {
        return None;
    }
    let q: HashMap<String, String> = u.query_pairs().into_owned().collect();
    Some((
        q.get("code").cloned(),
        q.get("state").cloned(),
        q.get("error").cloned(),
    ))
}

const DONE_PAGE: &str = "<!doctype html><meta charset=utf-8><title>RealmNest</title><body style=\"font-family:system-ui;padding:40px\"><h2>Accesso completato</h2><p>Puoi chiudere questa scheda e tornare a RealmNest.</p></body>";
const NOT_FOR_US: &[u8] =
    b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";

/// Wait for the browser to come back with the code. Anything else that reaches the listener
/// (another page, an answer whose `state` is not ours) is answered and ignored: it can
/// neither finish nor abort the sign-in.
async fn wait_for_code(listener: &tokio::net::TcpListener, state: &str) -> Result<String, String> {
    loop {
        let (mut sock, _) = listener.accept().await.map_err(|e| e.to_string())?;
        let mut buf = vec![0u8; 8192];
        let n = tokio::time::timeout(Duration::from_secs(5), sock.read(&mut buf))
            .await
            .ok()
            .and_then(|r| r.ok())
            .unwrap_or(0);
        let text = String::from_utf8_lossy(&buf[..n]).to_string();
        let line = text.lines().next().unwrap_or("");
        let Some((code, st, error)) = parse_callback(line) else {
            let _ = sock
                .write_all(
                    b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                )
                .await;
            continue;
        };
        if st.as_deref() != Some(state) {
            let _ = sock.write_all(NOT_FOR_US).await;
            continue;
        }
        let page = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{DONE_PAGE}", DONE_PAGE.len());
        let _ = sock.write_all(page.as_bytes()).await;
        if let Some(e) = error {
            return Err(format!(
                "the sign-in was refused ({})",
                e.chars().take(80).collect::<String>()
            ));
        }
        return code.ok_or_else(|| "the sign-in returned no code".to_string());
    }
}

/// The whole sign-in. `open` shows the authorization page in the user's browser.
pub async fn login(
    server_id: &str,
    mcp_url: &url::Url,
    open: impl Fn(&str) -> Result<(), String>,
) -> Result<(), String> {
    let local = is_loopback_host(mcp_url);
    let client = http_client(local)?;
    let ep = discover(&client, mcp_url, local).await?;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("could not listen for the sign-in ({e})"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect = format!("http://127.0.0.1:{port}/callback");

    // a client for RealmNest on this server (dynamic registration)
    let reg = ep
        .registration
        .clone()
        .ok_or("this server needs an app registered in advance; RealmNest cannot sign in to it")?;
    let body = serde_json::json!({
        "client_name": "RealmNest",
        "redirect_uris": [redirect],
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "none",
    });
    let r = client
        .post(reg)
        .json(&body)
        .send()
        .await
        .map_err(|_| "the sign-in server could not be reached".to_string())?;
    let status = r.status().as_u16();
    let v: Value = json_capped(r).await.unwrap_or(Value::Null);
    let client_id = v["client_id"]
        .as_str()
        .filter(|_| status < 300)
        .ok_or("this server does not let RealmNest register; it may accept only approved apps")?
        .to_string();
    let client_secret = v["client_secret"].as_str().map(String::from);

    let verifier = random(48)?;
    let state = random(18)?;
    let mut auth = ep.authorization.clone();
    {
        let mut q = auth.query_pairs_mut();
        q.append_pair("response_type", "code")
            .append_pair("client_id", &client_id)
            .append_pair("redirect_uri", &redirect)
            .append_pair("code_challenge", &challenge(&verifier))
            .append_pair("code_challenge_method", "S256")
            .append_pair("state", &state)
            .append_pair("resource", &ep.resource);
        if let Some(s) = &ep.scopes {
            q.append_pair("scope", s);
        }
    }
    open(auth.as_str())?;

    let code = tokio::time::timeout(LOGIN_TIMEOUT, wait_for_code(&listener, &state))
        .await
        .map_err(|_| "the sign-in took too long".to_string())??;

    let mut pairs = vec![
        ("grant_type", "authorization_code"),
        ("code", code.as_str()),
        ("redirect_uri", redirect.as_str()),
        ("client_id", client_id.as_str()),
        ("code_verifier", verifier.as_str()),
        ("resource", ep.resource.as_str()),
    ];
    if let Some(s) = &client_secret {
        pairs.push(("client_secret", s.as_str()));
    }
    let v = token_request(&client, &ep.token, form(&pairs)).await?;
    let mut t = Tokens {
        client_id,
        client_secret,
        token_endpoint: ep.token.to_string(),
        resource: ep.resource,
        access_token: String::new(),
        refresh_token: None,
        expires_at: None,
    };
    apply(&mut t, &v);
    save(server_id, &t)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pkce_challenge_matches_rfc7636() {
        // SHA-256("abc"), base64url without padding (the NIST test vector)
        assert_eq!(
            challenge("abc"),
            "ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0"
        );
    }

    #[test]
    fn callback_lines() {
        assert_eq!(
            parse_callback("GET /callback?code=abc&state=xyz HTTP/1.1"),
            Some((Some("abc".into()), Some("xyz".into()), None))
        );
        assert_eq!(
            parse_callback("GET /callback?error=access_denied HTTP/1.1")
                .unwrap()
                .2
                .as_deref(),
            Some("access_denied")
        );
        assert!(parse_callback("GET /favicon.ico HTTP/1.1").is_none());
    }

    #[test]
    fn well_known_paths() {
        let u = url::Url::parse("https://mcp.example.com/v1/mcp").unwrap();
        assert_eq!(
            well_known(&u, "oauth-protected-resource"),
            vec![
                "https://mcp.example.com/.well-known/oauth-protected-resource/v1/mcp",
                "https://mcp.example.com/.well-known/oauth-protected-resource"
            ]
        );
    }

    #[test]
    fn discovered_addresses_must_be_https_and_public() {
        assert!(check_endpoint("https://auth.example.com/token", false).is_ok());
        for bad in [
            "http://auth.example.com/token",
            "http://127.0.0.1:9999/token",
            "http://localhost/register",
            "https://127.0.0.1/token",
            "https://10.0.0.5/token",
            "https://169.254.169.254/latest",
            "https://[::1]/token",
            "https://intranet/token",
            "https://auth.local/token",
            "https://user:pw@auth.example.com/token",
            "ftp://auth.example.com/",
            "not a url",
        ] {
            assert!(check_endpoint(bad, false).is_err(), "{bad}");
        }
        // an MCP server on this computer may sign in on this computer, http included
        assert!(check_endpoint("http://127.0.0.1:9999/token", true).is_ok());
        assert!(check_endpoint("http://localhost:3000/register", true).is_ok());
        assert!(check_endpoint("https://10.0.0.5/token", true).is_ok());
        assert!(check_endpoint("http://auth.example.com/token", true).is_err());
    }

    #[test]
    fn the_resource_must_be_this_server_and_the_issuer_its_own_address() {
        let mcp = url::Url::parse("https://mcp.example.com/v1/mcp").unwrap();
        for ok in [
            "https://mcp.example.com/v1/mcp",
            "https://mcp.example.com/v1",
            "https://mcp.example.com/v1/",
            "https://mcp.example.com",
            "https://mcp.example.com/",
        ] {
            assert!(resource_matches(ok, &mcp), "{ok}");
        }
        for bad in [
            "https://api.other.com/v1/mcp",
            "https://mcp.example.com:8443/v1/mcp",
            "http://mcp.example.com/v1/mcp",
            "https://mcp.example.com/v1/mc",
            "https://mcp.example.com/v2",
            "garbage",
        ] {
            assert!(!resource_matches(bad, &mcp), "{bad}");
        }
        let issuer = url::Url::parse("https://auth.example.com/tenant").unwrap();
        assert!(issuer_matches(
            Some("https://auth.example.com/tenant"),
            &issuer
        ));
        assert!(issuer_matches(
            Some("https://auth.example.com/tenant/"),
            &issuer
        ));
        assert!(!issuer_matches(
            Some("https://evil.example.com/tenant"),
            &issuer
        ));
        assert!(!issuer_matches(None, &issuer));
        // a sign-in is used only for the address it was made for
        let t = Tokens {
            client_id: "c".into(),
            client_secret: None,
            token_endpoint: "https://auth.example.com/token".into(),
            resource: "https://mcp.example.com/v1/mcp".into(),
            access_token: "a".into(),
            refresh_token: None,
            expires_at: None,
        };
        assert!(issued_for(&t, &mcp));
        assert!(!issued_for(
            &t,
            &url::Url::parse("https://attacker.example.net/v1/mcp").unwrap()
        ));
    }

    #[test]
    fn one_refresh_gate_per_server() {
        let a = refresh_gate("srv-a");
        assert!(Arc::ptr_eq(&a, &refresh_gate("srv-a")));
        assert!(!Arc::ptr_eq(&a, &refresh_gate("srv-b")));
    }

    #[tokio::test]
    async fn a_callback_with_the_wrong_state_is_ignored() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let waiting = tokio::spawn(async move { wait_for_code(&listener, "good-state").await });
        let hit = |path: &'static str| async move {
            let mut s = tokio::net::TcpStream::connect(addr).await.unwrap();
            s.write_all(format!("GET {path} HTTP/1.1\r\nHost: x\r\n\r\n").as_bytes())
                .await
                .unwrap();
            let mut out = String::new();
            let _ = s.read_to_string(&mut out).await;
            out
        };
        // a stranger's answer (wrong state, even with an error) neither finishes nor aborts
        assert!(hit("/callback?code=evil&state=bad")
            .await
            .starts_with("HTTP/1.1 400"));
        assert!(hit("/callback?error=access_denied&state=bad")
            .await
            .starts_with("HTTP/1.1 400"));
        assert!(hit("/favicon.ico").await.starts_with("HTTP/1.1 404"));
        assert!(!waiting.is_finished());
        assert!(hit("/callback?code=real&state=good-state")
            .await
            .starts_with("HTTP/1.1 200"));
        assert_eq!(waiting.await.unwrap(), Ok("real".to_string()));
    }

    /// serves fixed JSON documents by path on 127.0.0.1 (a local MCP server and its sign-in)
    fn mock(docs: impl FnOnce(&str) -> Vec<(String, String)>) -> String {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let docs = docs(&base);
        std::thread::spawn(move || {
            for mut s in listener.incoming().flatten() {
                let mut buf = [0u8; 4096];
                let n = s.read(&mut buf).unwrap_or(0);
                let req = String::from_utf8_lossy(&buf[..n]).to_string();
                let path = req.split_whitespace().nth(1).unwrap_or("").to_string();
                let reply = match docs.iter().find(|(p, _)| *p == path) {
                    Some((_, body)) => format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                        body.len()
                    ),
                    None => "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".into(),
                };
                let _ = s.write_all(reply.as_bytes());
            }
        });
        base
    }

    #[tokio::test]
    async fn discovery_refuses_metadata_for_another_resource_or_issuer() {
        let client = http_client(true).unwrap();
        // the protected-resource metadata names another service
        let base = mock(|_| {
            vec![(
                "/.well-known/oauth-protected-resource/mcp".into(),
                r#"{"resource":"https://api.other.com/","authorization_servers":["https://auth.other.com"]}"#.into(),
            )]
        });
        let mcp = url::Url::parse(&format!("{base}/mcp")).unwrap();
        let e = discover(&client, &mcp, true).await.unwrap_err();
        assert!(e.contains("resource"), "{e}");

        // the authorization server's metadata claims another issuer
        let base = mock(|_| {
            vec![(
                "/.well-known/oauth-authorization-server".into(),
                r#"{"issuer":"https://evil.example.com","authorization_endpoint":"https://evil.example.com/a","token_endpoint":"https://evil.example.com/t"}"#.into(),
            )]
        });
        let mcp = url::Url::parse(&format!("{base}/mcp")).unwrap();
        let e = discover(&client, &mcp, true).await.unwrap_err();
        assert!(e.contains("issuer"), "{e}");

        // a well-formed local setup
        let base = mock(|base| {
            vec![
                (
                    "/.well-known/oauth-protected-resource/mcp".into(),
                    format!(r#"{{"resource":"{base}/mcp","authorization_servers":["{base}"]}}"#),
                ),
                (
                    "/.well-known/oauth-authorization-server".into(),
                    format!(
                        r#"{{"issuer":"{base}","authorization_endpoint":"{base}/authorize","token_endpoint":"{base}/token","registration_endpoint":"{base}/register"}}"#
                    ),
                ),
            ]
        });
        let mcp = url::Url::parse(&format!("{base}/mcp")).unwrap();
        let ep = discover(&client, &mcp, true).await.unwrap();
        assert_eq!(ep.token.as_str(), format!("{base}/token"));
        assert_eq!(ep.resource, format!("{base}/mcp"));
        // the same metadata for a server that is not local: plain http is refused
        assert!(discover(&client, &mcp, false).await.is_err());
    }
}
