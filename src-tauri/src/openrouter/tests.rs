//! Against a local mock HTTP server (plain HTTP on 127.0.0.1; production is HTTPS-only).

use super::*;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::AtomicBool;
use std::thread;

struct Reply {
    head: String,
    chunks: Vec<(String, u64)>,
    /// keep writing keep-alives until the client goes away
    hold: bool,
}

fn reply(status: &str, content_type: &str, body: &str) -> Reply {
    Reply {
        head: format!(
            "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nConnection: close\r\n\r\n"
        ),
        chunks: vec![(body.into(), 0)],
        hold: false,
    }
}

fn sse(chunks: &[&str]) -> Reply {
    Reply {
        head: "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n\r\n"
            .into(),
        chunks: chunks.iter().map(|c| (c.to_string(), 5)).collect(),
        hold: false,
    }
}

struct Mock {
    base: String,
    requests: Arc<Mutex<Vec<String>>>,
    client_left: Arc<AtomicBool>,
}

fn read_request(s: &mut TcpStream) -> String {
    let mut buf = Vec::new();
    let mut tmp = [0u8; 4096];
    loop {
        let n = s.read(&mut tmp).unwrap_or(0);
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&tmp[..n]);
        if let Some(end) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
            let head = String::from_utf8_lossy(&buf[..end]).to_string();
            let len = head
                .lines()
                .find_map(|l| {
                    l.to_lowercase()
                        .strip_prefix("content-length:")
                        .map(|v| v.trim().parse::<usize>().unwrap_or(0))
                })
                .unwrap_or(0);
            while buf.len() < end + 4 + len {
                let n = s.read(&mut tmp).unwrap_or(0);
                if n == 0 {
                    break;
                }
                buf.extend_from_slice(&tmp[..n]);
            }
            break;
        }
    }
    String::from_utf8_lossy(&buf).to_string()
}

/// serves the replies in order, one per connection
fn mock(replies: Vec<Reply>) -> Mock {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let requests = Arc::new(Mutex::new(Vec::new()));
    let client_left = Arc::new(AtomicBool::new(false));
    let (rq, left) = (requests.clone(), client_left.clone());
    thread::spawn(move || {
        for r in replies {
            let Ok((mut s, _)) = listener.accept() else {
                return;
            };
            rq.lock().unwrap().push(read_request(&mut s));
            let _ = s.write_all(r.head.as_bytes());
            for (c, delay) in &r.chunks {
                thread::sleep(Duration::from_millis(*delay));
                let _ = s.write_all(c.as_bytes());
                let _ = s.flush();
            }
            if r.hold {
                for _ in 0..400 {
                    thread::sleep(Duration::from_millis(25));
                    if s.write_all(b": keep-alive\n\n")
                        .and_then(|_| s.flush())
                        .is_err()
                    {
                        left.store(true, Ordering::SeqCst);
                        break;
                    }
                }
            }
        }
    });
    Mock {
        base,
        requests,
        client_left,
    }
}

#[derive(Default)]
struct Collect(Mutex<Vec<StreamEvent>>);
impl EventSink for Collect {
    fn send(&self, e: StreamEvent) {
        self.0.lock().unwrap().push(e);
    }
}

fn text_msg(role: &str, text: &str) -> ChatMessage {
    ChatMessage {
        role: role.into(),
        content: Some(text.into()),
        tool_calls: None,
        tool_call_id: None,
    }
}

fn req(model: &str) -> ChatRequest {
    ChatRequest {
        tools: vec![],
        model: model.into(),
        messages: vec![text_msg("system", "You are Alex."), text_msg("user", "hi")],
        max_tokens: None,
        temperature: None,
        timeout_ms: None,
        response_schema: None,
        web_search: None,
        effort: None,
    }
}

async fn run_chat(client: &Client, key: Option<&str>, r: ChatRequest) -> Vec<StreamEvent> {
    let sink = Collect::default();
    let (_tx, rx) = watch::channel(false);
    client.chat(key.map(String::from), r, &sink, rx).await;
    sink.0.into_inner().unwrap()
}

const KEY: &str = "sk-or-v1-test-0123456789abcdef";

#[tokio::test]
async fn validates_keys_without_generating() {
    let m = mock(vec![
        reply(
            "200 OK",
            "application/json",
            r#"{"data":{"label":"x","is_free_tier":false}}"#,
        ),
        reply(
            "401 Unauthorized",
            "application/json",
            r#"{"error":{"message":"User not found.","code":401}}"#,
        ),
    ]);
    let c = Client::with_base(&m.base, false);
    assert_eq!(c.validate(Some(KEY.into())).await.status, "connected");
    assert_eq!(
        c.validate(Some(KEY.into())).await.status,
        "invalid_credentials"
    );
    assert_eq!(c.validate(None).await.status, "missing_key");
    let reqs = m.requests.lock().unwrap();
    assert!(reqs[0].starts_with("GET /key "));
    assert!(
        reqs[0].contains(&format!("authorization: Bearer {KEY}"))
            || reqs[0].contains(&format!("Authorization: Bearer {KEY}"))
    );
}

#[tokio::test]
async fn reads_the_keys_spending_and_cap() {
    let m = mock(vec![
        reply(
            "200 OK",
            "application/json",
            r#"{"data":{"label":"x","usage":6.8,"usage_daily":0.41,"usage_weekly":2.5,"usage_monthly":6.8,"limit":10,"limit_remaining":3.2,"limit_reset":"monthly","is_free_tier":false}}"#,
        ),
        reply(
            "200 OK",
            "application/json",
            r#"{"data":{"usage":0,"limit":null,"is_free_tier":true}}"#,
        ),
        reply(
            "401 Unauthorized",
            "application/json",
            r#"{"error":{"message":"no","code":401}}"#,
        ),
    ]);
    let c = Client::with_base(&m.base, false);
    let k = c.credits(Some(KEY.into())).await.unwrap();
    assert_eq!(
        (
            k.usage_daily,
            k.limit,
            k.limit_remaining,
            k.limit_reset.as_deref()
        ),
        (Some(0.41), Some(10.0), Some(3.2), Some("monthly"))
    );
    let free = c.credits(Some(KEY.into())).await.unwrap();
    assert_eq!((free.limit, free.is_free_tier), (None, Some(true)));
    assert_eq!(
        c.credits(Some(KEY.into())).await.unwrap_err().code,
        "invalid_credentials"
    );
    assert_eq!(c.credits(None).await.unwrap_err().code, "missing_key");
}

#[tokio::test]
async fn never_follows_a_redirect_with_the_key() {
    let elsewhere = mock(vec![reply("200 OK", "application/json", "{}")]);
    let m = mock(vec![Reply {
        head: format!("HTTP/1.1 302 Found\r\nLocation: {}/steal\r\nContent-Length: 0\r\nConnection: close\r\n\r\n", elsewhere.base),
        chunks: vec![],
        hold: false,
    }]);
    let c = Client::with_base(&m.base, false);
    let v = c.validate(Some(KEY.into())).await;
    assert_eq!(v.status, "error");
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert!(
        elsewhere.requests.lock().unwrap().is_empty(),
        "the key must not reach another host"
    );
}

#[tokio::test]
async fn production_client_refuses_plain_http() {
    let m = mock(vec![reply("200 OK", "application/json", "{}")]);
    let c = Client::with_base(&m.base, true);
    assert_eq!(c.validate(Some(KEY.into())).await.status, "unavailable");
}

#[tokio::test]
async fn fetches_the_catalogue_without_the_key() {
    let m = mock(vec![reply(
        "200 OK",
        "application/json",
        include_str!("../../../src/tests/fixtures/openrouter/models.sample.json"),
    )]);
    let c = Client::with_base(&m.base, false);
    let models = c.models().await.unwrap();
    assert_eq!(models.len(), 4);
    assert!(!m.requests.lock().unwrap()[0]
        .to_lowercase()
        .contains("authorization"));
}

#[tokio::test]
async fn streams_text_usage_and_done() {
    let m = mock(vec![sse(&[
        ": OPENROUTER PROCESSING\n\n",
        "data: {\"id\":\"gen-1\",\"model\":\"acme/fast\",\"choices\":[{\"delta\":{\"content\":\"RealmNest \"}}]}\n\n",
        "data: {\"id\":\"gen-1\",\"model\":\"acme/fast\",\"choices\":[{\"delta\":{\"content\":\"OpenRouter\"},\"finish_reason\":null}]}\n\n",
        "data: {\"id\":\"gen-1\",\"choices\":[{\"delta\":{\"content\":\"\"},\"finish_reason\":\"stop\"}]}\n\n",
        "data: {\"id\":\"gen-1\",\"choices\":[{\"delta\":{\"content\":\"\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":12,\"completion_tokens\":3,\"cost\":0.00002}}\n\n",
        "data: [DONE]\n\n",
    ])]);
    let c = Client::with_base(&m.base, false);
    let events = run_chat(&c, Some(KEY), req("acme/fast")).await;
    assert_eq!(
        events,
        vec![
            StreamEvent::Start {
                model: Some("acme/fast".into())
            },
            StreamEvent::Delta {
                d: "RealmNest ".into()
            },
            StreamEvent::Delta {
                d: "OpenRouter".into()
            },
            StreamEvent::Usage {
                prompt: 12,
                completion: 3,
                cost: Some(0.00002)
            },
            StreamEvent::Done {
                finish_reason: Some("stop".into())
            },
        ]
    );
    let sent = m.requests.lock().unwrap()[0].clone();
    assert!(sent.starts_with("POST /chat/completions "));
    assert!(
        sent.contains("\"stream\":true")
            && sent.contains("\"model\":\"acme/fast\"")
            && sent.contains("\"role\":\"system\"")
    );
}

#[tokio::test]
async fn normalizes_http_errors() {
    let cases = [
        ("401 Unauthorized", "invalid_credentials"),
        ("402 Payment Required", "payment_required"),
        ("404 Not Found", "model_unavailable"),
        ("429 Too Many Requests", "rate_limited"),
        ("503 Service Unavailable", "provider_unavailable"),
    ];
    for (status, code) in cases {
        let m = mock(vec![reply(
            status,
            "application/json",
            &format!("{{\"error\":{{\"message\":\"failed for key {KEY}\",\"code\":0}}}}"),
        )]);
        let c = Client::with_base(&m.base, false);
        let events = run_chat(&c, Some(KEY), req("acme/fast")).await;
        match events.last().unwrap() {
            StreamEvent::Error(e) => {
                assert_eq!(e.code, code, "{status}");
                assert!(
                    !e.message.contains(KEY),
                    "the key must be redacted: {}",
                    e.message
                );
            }
            other => panic!("{status}: expected an error, got {other:?}"),
        }
    }
}

#[tokio::test]
async fn reports_errors_that_arrive_mid_stream() {
    let m = mock(vec![sse(&[
        "data: {\"choices\":[{\"delta\":{\"content\":\"par\"}}]}\n\n",
        "data: {\"error\":{\"code\":429,\"message\":\"slow down\"},\"choices\":[{\"finish_reason\":\"error\"}]}\n\n",
    ])]);
    let c = Client::with_base(&m.base, false);
    let events = run_chat(&c, Some(KEY), req("acme/fast")).await;
    assert!(matches!(events.last().unwrap(), StreamEvent::Error(e) if e.code == "rate_limited"));
    assert!(events.contains(&StreamEvent::Delta { d: "par".into() }));
}

#[tokio::test]
async fn an_unfinished_stream_is_a_failure() {
    let m = mock(vec![sse(&[
        "data: {\"choices\":[{\"delta\":{\"content\":\"half\"}}]}\n\n",
    ])]);
    let c = Client::with_base(&m.base, false);
    let events = run_chat(&c, Some(KEY), req("acme/fast")).await;
    assert!(matches!(events.last().unwrap(), StreamEvent::Error(e) if e.code == "malformed"));
}

#[tokio::test]
async fn refuses_bad_requests_before_any_network_call() {
    let m = mock(vec![]);
    let c = Client::with_base(&m.base, false);
    let mut bad = req("acme/fast");
    bad.messages[0].role = "tool".into();
    assert!(
        matches!(run_chat(&c, Some(KEY), bad).await.last().unwrap(), StreamEvent::Error(e) if e.code == "bad_request")
    );
    assert!(
        matches!(run_chat(&c, Some(KEY), req("bad model id")).await.last().unwrap(), StreamEvent::Error(e) if e.code == "bad_request")
    );
    assert!(
        matches!(run_chat(&c, None, req("acme/fast")).await.last().unwrap(), StreamEvent::Error(e) if e.code == "missing_key")
    );
    assert!(m.requests.lock().unwrap().is_empty());
}

#[tokio::test(flavor = "multi_thread")]
async fn cancel_closes_the_http_connection() {
    let mut r = sse(&["data: {\"choices\":[{\"delta\":{\"content\":\"long \"}}]}\n\n"]);
    r.hold = true;
    let m = mock(vec![r]);
    let host = OpenRouterHost::new(Client::with_base(&m.base, false));
    let sink = Arc::new(Collect::default());
    let id = host.start(Some(KEY.into()), req("acme/fast"), sink.clone());
    for _ in 0..100 {
        if sink
            .0
            .lock()
            .unwrap()
            .iter()
            .any(|e| matches!(e, StreamEvent::Delta { .. }))
        {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    assert!(host.cancel(&id));
    for _ in 0..200 {
        if m.client_left.load(Ordering::SeqCst)
            && sink.0.lock().unwrap().last() == Some(&StreamEvent::Cancelled)
        {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    assert_eq!(sink.0.lock().unwrap().last(), Some(&StreamEvent::Cancelled));
    assert!(
        m.client_left.load(Ordering::SeqCst),
        "the server must see the connection close"
    );
    assert!(!host.cancel(&id), "finished runs are forgotten");
}

#[tokio::test]
async fn a_stalled_reply_times_out() {
    let mut r = sse(&["data: {\"choices\":[{\"delta\":{\"content\":\"x\"}}]}\n\n"]);
    r.hold = true; // only keep-alives from here on
    let m = mock(vec![r]);
    let c = Client::with_base(&m.base, false);
    let mut short = req("acme/fast");
    short.timeout_ms = Some(1_000);
    let events = run_chat(&c, Some(KEY), short).await;
    assert!(matches!(events.last().unwrap(), StreamEvent::Error(e) if e.code == "timeout"));
}

#[tokio::test]
async fn an_error_body_that_never_ends_still_ends_the_turn() {
    // the status says error, then the body trickles forever (keep-alives): the deadline wins
    let mut r = reply(
        "500 Internal Server Error",
        "application/json",
        "{\"error\":",
    );
    r.hold = true;
    let m = mock(vec![r]);
    let c = Client::with_base(&m.base, false);
    let mut short = req("acme/fast");
    short.timeout_ms = Some(1_000);
    let started = std::time::Instant::now();
    let events = run_chat(&c, Some(KEY), short).await;
    assert!(matches!(events.last().unwrap(), StreamEvent::Error(_)));
    assert!(
        started.elapsed() < Duration::from_secs(5),
        "{:?}",
        started.elapsed()
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn stop_works_while_an_error_body_is_read() {
    let mut r = reply("503 Service Unavailable", "application/json", "{\"error\":");
    r.hold = true;
    let m = mock(vec![r]);
    let host = OpenRouterHost::new(Client::with_base(&m.base, false));
    let sink = Arc::new(Collect::default());
    let id = host.start(Some(KEY.into()), req("acme/fast"), sink.clone());
    tokio::time::sleep(Duration::from_millis(400)).await;
    assert!(host.cancel(&id));
    for _ in 0..100 {
        if !sink.0.lock().unwrap().is_empty() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    assert_eq!(sink.0.lock().unwrap().last(), Some(&StreamEvent::Cancelled));
}

#[test]
fn redacts_keys_and_bearer_tokens() {
    let s = redact(&format!(
        "bad key {KEY} and Authorization: Bearer abc.def.ghi"
    ));
    assert!(!s.contains(KEY) && !s.contains("abc.def.ghi"), "{s}");
}

#[test]
fn stream_events_serialize_for_the_typescript_side() {
    let j = |e: StreamEvent| serde_json::to_value(e).unwrap();
    assert_eq!(
        j(StreamEvent::Delta { d: "x".into() }),
        serde_json::json!({ "t": "delta", "d": "x" })
    );
    assert_eq!(
        j(StreamEvent::Done {
            finish_reason: Some("stop".into())
        }),
        serde_json::json!({ "t": "done", "finishReason": "stop" })
    );
    assert_eq!(
        j(StreamEvent::Error(OrError {
            code: "rate_limited".into(),
            message: "m".into(),
            status: Some(429)
        })),
        serde_json::json!({ "t": "error", "code": "rate_limited", "message": "m", "status": 429 })
    );
    assert_eq!(
        j(StreamEvent::Cancelled),
        serde_json::json!({ "t": "cancelled" })
    );
}

fn with_parts(role: &str, parts: Vec<Part>) -> ChatRequest {
    let mut r = req("openai/gpt-4o");
    r.messages.push(ChatMessage {
        role: role.into(),
        content: Some(MessageContent::Parts(parts)),
        tool_calls: None,
        tool_call_id: None,
    });
    r
}

#[test]
fn sends_inline_images_and_pdfs_as_parts() {
    let r = with_parts(
        "user",
        vec![
            Part::Text {
                text: "what is this?".into(),
            },
            Part::ImageUrl {
                image_url: ImageUrl {
                    url: "data:image/png;base64,iVBORw0KGgo=".into(),
                },
            },
            Part::File {
                file: FileData {
                    filename: "doc.pdf".into(),
                    file_data: "data:application/pdf;base64,JVBERi0=".into(),
                },
            },
        ],
    );
    let body = build_body(&r).expect("valid");
    let parts = &body["messages"][2]["content"];
    assert_eq!(parts[0]["type"], "text");
    assert_eq!(parts[1]["type"], "image_url");
    assert_eq!(
        parts[1]["image_url"]["url"],
        "data:image/png;base64,iVBORw0KGgo="
    );
    assert_eq!(parts[2]["type"], "file");
    assert_eq!(parts[2]["file"]["filename"], "doc.pdf");
    // plain messages stay plain strings
    assert_eq!(body["messages"][1]["content"], "hi");
}

#[test]
fn refuses_remote_urls_and_odd_parts() {
    let remote = with_parts(
        "user",
        vec![Part::ImageUrl {
            image_url: ImageUrl {
                url: "https://example.com/a.png".into(),
            },
        }],
    );
    assert_eq!(build_body(&remote).unwrap_err().code, "bad_request");
    let not_pdf = with_parts(
        "user",
        vec![Part::File {
            file: FileData {
                filename: "a.exe".into(),
                file_data: "data:application/octet-stream;base64,AA==".into(),
            },
        }],
    );
    assert_eq!(build_body(&not_pdf).unwrap_err().code, "bad_request");
    let assistant = with_parts("assistant", vec![Part::Text { text: "x".into() }]);
    assert_eq!(build_body(&assistant).unwrap_err().code, "bad_request");
    // the parts arrive from the webview as JSON: the untagged content parses both shapes
    let parsed: ChatMessage = serde_json::from_str(
        r#"{"role":"user","content":[{"type":"text","text":"a"},{"type":"image_url","image_url":{"url":"data:image/webp;base64,AA=="}}]}"#,
    )
    .unwrap();
    assert!(matches!(parsed.content, Some(MessageContent::Parts(ref p)) if p.len() == 2));
}

fn tool_spec(name: &str) -> ToolSpec {
    ToolSpec {
        kind: "function".into(),
        function: FunctionSpec {
            name: name.into(),
            description: "Writes a text file in the workspace.".into(),
            parameters: serde_json::json!({ "type": "object", "properties": { "path": { "type": "string" } } }),
        },
    }
}

#[tokio::test]
async fn offers_tools_and_assembles_streamed_tool_calls() {
    let m = mock(vec![sse(&[
        "data: {\"model\":\"acme/fast\",\"choices\":[{\"delta\":{\"role\":\"assistant\",\"content\":null,\"tool_calls\":[{\"index\":0,\"id\":\"call_1\",\"type\":\"function\",\"function\":{\"name\":\"write_text_file\",\"arguments\":\"\"}}]}}]}\n\n",
        "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"{\\\"path\\\":\\\"hel\"}}]}}]}\n\n",
        "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"lo.txt\\\"}\"}},{\"index\":1,\"id\":\"call_2\",\"function\":{\"name\":\"get_current_time\",\"arguments\":\"{}\"}}]}}]}\n\n",
        "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"tool_calls\"}]}\n\n",
        "data: [DONE]\n\n",
    ])]);
    let c = Client::with_base(&m.base, false);
    let mut r = req("acme/fast");
    r.tools = vec![tool_spec("write_text_file"), tool_spec("get_current_time")];
    let events = run_chat(&c, Some(KEY), r).await;
    assert_eq!(
        events[1..],
        [
            StreamEvent::Tool {
                id: "call_1".into(),
                name: "write_text_file".into(),
                args: "{\"path\":\"hello.txt\"}".into()
            },
            StreamEvent::Tool {
                id: "call_2".into(),
                name: "get_current_time".into(),
                args: "{}".into()
            },
            StreamEvent::Done {
                finish_reason: Some("tool_calls".into())
            },
        ]
    );
    let sent = m.requests.lock().unwrap()[0].clone();
    assert!(
        sent.contains("\"tools\":[")
            && sent.contains("\"tool_choice\":\"auto\"")
            && sent.contains("\"name\":\"write_text_file\"")
    );
}

#[test]
fn sends_tool_calls_and_results_back() {
    let mut r = req("acme/fast");
    r.messages.push(ChatMessage {
        role: "assistant".into(),
        content: None,
        tool_calls: Some(vec![ToolCallOut {
            id: "call_1".into(),
            kind: "function".into(),
            function: FunctionCall {
                name: "write_text_file".into(),
                arguments: "{}".into(),
            },
        }]),
        tool_call_id: None,
    });
    r.messages.push(ChatMessage {
        role: "tool".into(),
        content: Some("{\"ok\":true}".into()),
        tool_calls: None,
        tool_call_id: Some("call_1".into()),
    });
    let body = build_body(&r).expect("valid");
    assert_eq!(body["messages"][2]["content"], serde_json::Value::Null);
    assert_eq!(
        body["messages"][2]["tool_calls"][0]["function"]["name"],
        "write_text_file"
    );
    assert_eq!(body["messages"][3]["role"], "tool");
    assert_eq!(body["messages"][3]["tool_call_id"], "call_1");
    assert!(body.get("tools").is_none());
}

#[test]
fn refuses_bad_tools_and_tool_messages() {
    let mut r = req("acme/fast");
    r.tools = vec![tool_spec("rm -rf /")];
    assert_eq!(build_body(&r).unwrap_err().code, "bad_request");
    let mut r = req("acme/fast");
    r.tools = (0..40).map(|i| tool_spec(&format!("t{i}"))).collect();
    assert_eq!(build_body(&r).unwrap_err().code, "bad_request");
    let mut r = req("acme/fast");
    let mut big = tool_spec("big");
    big.function.parameters =
        serde_json::json!({ "type": "object", "description": "x".repeat(20_000) });
    r.tools = vec![big];
    assert_eq!(build_body(&r).unwrap_err().code, "bad_request");
    // a tool result without its call id, and a user message pretending to call tools
    let mut r = req("acme/fast");
    r.messages.push(ChatMessage {
        role: "tool".into(),
        content: Some("x".into()),
        tool_calls: None,
        tool_call_id: None,
    });
    assert_eq!(build_body(&r).unwrap_err().code, "bad_request");
    let mut r = req("acme/fast");
    r.messages.push(ChatMessage {
        role: "user".into(),
        content: Some("x".into()),
        tool_calls: Some(vec![ToolCallOut {
            id: "c".into(),
            kind: "function".into(),
            function: FunctionCall {
                name: "a".into(),
                arguments: "{}".into(),
            },
        }]),
        tool_call_id: None,
    });
    assert_eq!(build_body(&r).unwrap_err().code, "bad_request");
}

#[test]
fn caps_streamed_tool_calls() {
    let mut calls = Vec::new();
    let many: Vec<serde_json::Value> = (0..20).map(|i| serde_json::json!({ "index": i, "id": format!("c{i}"), "function": { "name": "t", "arguments": "{}" } })).collect();
    assert_eq!(
        add_tool_deltas(&mut calls, &many).unwrap_err().code,
        "too_large"
    );
    let mut calls = Vec::new();
    let huge = serde_json::json!([{ "index": 0, "id": "c", "function": { "name": "t", "arguments": "x".repeat(MAX_TOOL_ARGS_BYTES + 1) } }]);
    assert_eq!(
        add_tool_deltas(&mut calls, huge.as_array().unwrap())
            .unwrap_err()
            .code,
        "too_large"
    );
}

#[test]
fn a_response_schema_becomes_a_strict_json_schema_format() {
    let mut r = req("m");
    r.response_schema = Some(ResponseSchema {
        name: "memory_proposals".into(),
        schema: serde_json::json!({ "type": "object", "properties": {} }),
    });
    let body = build_body(&r).expect("valid");
    assert_eq!(body["response_format"]["type"], "json_schema");
    assert_eq!(
        body["response_format"]["json_schema"]["name"],
        "memory_proposals"
    );
    assert_eq!(body["response_format"]["json_schema"]["strict"], true);
    r.response_schema = Some(ResponseSchema {
        name: "bad name".into(),
        schema: serde_json::json!({}),
    });
    assert_eq!(build_body(&r).unwrap_err().code, "bad_request");
    r.response_schema = Some(ResponseSchema {
        name: "x".into(),
        schema: serde_json::json!("not an object"),
    });
    assert_eq!(build_body(&r).unwrap_err().code, "bad_request");
    assert!(build_body(&req("m"))
        .unwrap()
        .get("response_format")
        .is_none());
}

#[test]
fn web_plugin_is_requested_and_citations_are_hits() {
    let mut r = req("openai/gpt-x");
    r.web_search = Some(25);
    let body = build_body(&r).unwrap();
    assert_eq!(
        body["plugins"],
        serde_json::json!([{ "id": "web", "max_results": 10 }])
    );
    assert!(build_body(&req("openai/gpt-x"))
        .unwrap()
        .get("plugins")
        .is_none());
    assert_eq!(
        search_hit(Some("https://a.example/x"), Some(" A "), Some("snip"), None)
            .unwrap()
            .title
            .as_deref(),
        Some("A")
    );
    assert!(search_hit(Some("file:///etc/passwd"), None, None, None).is_none());
}

#[test]
fn reasoning_effort_is_one_known_level_on_openrouter_only() {
    let mut r = req("openai/gpt-x");
    r.effort = Some("high".into());
    assert_eq!(
        build_body(&r).unwrap()["reasoning"],
        serde_json::json!({ "effort": "high" })
    );
    assert!(build_body(&req("openai/gpt-x"))
        .unwrap()
        .get("reasoning")
        .is_none());
    for bad in ["ultra", "max", "High", "", "high\", \"x\": \"y"] {
        r.effort = Some(bad.into());
        assert_eq!(build_body(&r).unwrap_err().code, "bad_request", "{bad}");
    }
    // OpenAI and Ollama take no effort in RealmNest
    r.effort = Some("low".into());
    for flavor in [Flavor::OpenAi, Flavor::Ollama] {
        assert_eq!(build_body_for(flavor, &r).unwrap_err().code, "bad_request");
    }
}

mod flavors;
