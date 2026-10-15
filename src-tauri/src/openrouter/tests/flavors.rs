//! OpenAI and Ollama flavors (compat.rs), against the same local mock server.

use super::*;
use compat::*;
use std::ffi::OsStr;
use std::path::PathBuf;

fn has_header(req: &str, name: &str) -> bool {
    req.to_ascii_lowercase()
        .contains(&format!("\r\n{}:", name.to_ascii_lowercase()))
}

/// a port nothing listens on
fn closed_base() -> String {
    let l = TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}", l.local_addr().unwrap());
    drop(l);
    base
}

#[test]
fn openai_body_counts_usage_and_completion_tokens_without_plugins() {
    let mut r = req("gpt-4.1-mini");
    r.max_tokens = Some(300);
    let body = build_body_for(Flavor::OpenAi, &r).unwrap();
    assert_eq!(
        body["stream_options"],
        serde_json::json!({ "include_usage": true })
    );
    assert_eq!(body["max_completion_tokens"], 300);
    assert!(body.get("max_tokens").is_none());
    assert!(body.get("plugins").is_none());
    // OpenAI would reject OpenRouter's plugin field: refused before any network call
    r.web_search = Some(3);
    assert_eq!(
        build_body_for(Flavor::OpenAi, &r).unwrap_err().code,
        "bad_request"
    );
    // OpenRouter's own body is unchanged
    let or = build_body(&req("m")).unwrap();
    assert!(or.get("stream_options").is_none());
}

#[test]
fn ollama_body_takes_images_but_not_pdfs() {
    let mut r = req("qwen3:latest");
    r.max_tokens = Some(50);
    let body = build_body_for(Flavor::Ollama, &r).unwrap();
    assert_eq!(body["max_tokens"], 50);
    assert_eq!(body["stream_options"]["include_usage"], true);
    let img = with_parts(
        "user",
        vec![Part::ImageUrl {
            image_url: ImageUrl {
                url: "data:image/png;base64,AAAA".into(),
            },
        }],
    );
    assert!(build_body_for(Flavor::Ollama, &img).is_ok());
    let pdf = with_parts(
        "user",
        vec![Part::File {
            file: FileData {
                filename: "a.pdf".into(),
                file_data: "data:application/pdf;base64,AAAA".into(),
            },
        }],
    );
    assert!(build_body_for(Flavor::OpenAi, &pdf).is_ok());
    assert_eq!(
        build_body_for(Flavor::Ollama, &pdf).unwrap_err().code,
        "bad_request"
    );
}

#[tokio::test]
async fn openai_streams_usage_from_the_last_chunk() {
    let m = mock(vec![sse(&[
        "data: {\"model\":\"gpt-4.1-mini\",\"choices\":[{\"delta\":{\"role\":\"assistant\",\"content\":\"Hi\"},\"finish_reason\":null}]}\n\n",
        "data: {\"model\":\"gpt-4.1-mini\",\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n",
        "data: {\"model\":\"gpt-4.1-mini\",\"choices\":[],\"usage\":{\"prompt_tokens\":9,\"completion_tokens\":1}}\n\n",
        "data: [DONE]\n\n",
    ])]);
    let c = Client::flavor_with_base(Flavor::OpenAi, &m.base, false);
    let events = run_chat(&c, Some(KEY), req("gpt-4.1-mini")).await;
    assert_eq!(
        &events[1..],
        &[
            StreamEvent::Delta { d: "Hi".into() },
            StreamEvent::Usage {
                prompt: 9,
                completion: 1,
                cost: None
            },
            StreamEvent::Done {
                finish_reason: Some("stop".into())
            },
        ]
    );
    let sent = m.requests.lock().unwrap()[0].clone();
    assert!(sent.starts_with("POST /chat/completions "));
    assert!(has_header(&sent, "authorization"));
    assert!(!has_header(&sent, "x-title"));
    assert!(sent.contains("\"include_usage\":true"));
    // no key: refused without a request
    let none = run_chat(&c, None, req("gpt-4.1-mini")).await;
    assert!(matches!(&none[..], [StreamEvent::Error(e)] if e.code == "missing_key"));
}

#[tokio::test]
async fn ollama_chats_without_a_key_and_splits_whole_tool_calls() {
    let m = mock(vec![sse(&[
        "data: {\"model\":\"qwen3:latest\",\"choices\":[{\"delta\":{\"tool_calls\":[{\"id\":\"call_a\",\"index\":0,\"type\":\"function\",\"function\":{\"name\":\"get_time\",\"arguments\":\"{}\"}}]}}]}\n\n",
        "data: {\"model\":\"qwen3:latest\",\"choices\":[{\"delta\":{\"tool_calls\":[{\"id\":\"call_b\",\"index\":0,\"type\":\"function\",\"function\":{\"name\":\"read_text\",\"arguments\":\"{\\\"path\\\":\\\"a\\\"}\"}}]}}]}\n\n",
        "data: {\"model\":\"qwen3:latest\",\"choices\":[{\"delta\":{},\"finish_reason\":\"tool_calls\"}]}\n\n",
        "data: {\"model\":\"qwen3:latest\",\"choices\":[],\"usage\":{\"prompt_tokens\":30,\"completion_tokens\":12}}\n\n",
        "data: [DONE]\n\n",
    ])]);
    let c = Client::flavor_with_base(Flavor::Ollama, &m.base, false);
    let mut r = req("qwen3:latest");
    r.tools = vec![tool_spec("get_time"), tool_spec("read_text")];
    let events = run_chat(&c, None, r).await;
    let tools: Vec<_> = events
        .iter()
        .filter_map(|e| match e {
            StreamEvent::Tool { id, name, args } => {
                Some((id.as_str(), name.as_str(), args.as_str()))
            }
            _ => None,
        })
        .collect();
    assert_eq!(
        tools,
        vec![
            ("call_a", "get_time", "{}"),
            ("call_b", "read_text", "{\"path\":\"a\"}")
        ]
    );
    assert!(events.contains(&StreamEvent::Usage {
        prompt: 30,
        completion: 12,
        cost: None
    }));
    let sent = m.requests.lock().unwrap()[0].clone();
    assert!(sent.starts_with("POST /v1/chat/completions "));
    assert!(!has_header(&sent, "authorization"));
}

#[test]
fn parses_the_openai_model_list() {
    let body = br#"{"object":"list","data":[
        {"id":"gpt-4.1-mini","object":"model","owned_by":"system"},
        {"id":"text-embedding-3-small","object":"model"},
        {"id":"whisper-1","object":"model"},
        {"id":"dall-e-3","object":"model"},
        {"id":"gpt-4o-realtime-preview","object":"model"},
        {"id":"o4-mini","object":"model"},
        {"id":"bad id","object":"model"}]}"#;
    let chat = normalize_openai(body).unwrap();
    assert_eq!(
        chat.iter().map(|m| m.id.as_str()).collect::<Vec<_>>(),
        vec!["gpt-4.1-mini", "o4-mini"]
    );
    // the list says nothing about modalities: left unknown, never guessed
    assert!(chat[0].input_modalities.is_empty() && chat[0].supported_parameters.is_empty());
    assert_eq!(chat[0].provider_label, "openai");
    let emb = openai_embedding_models(body).unwrap();
    assert_eq!(emb.len(), 1);
    assert_eq!(emb[0].id, "text-embedding-3-small");
    assert!(normalize_openai(b"<html>").is_err());
}

#[test]
fn parses_ollama_tags_and_capabilities() {
    let tags = br#"{"models":[
        {"name":"qwen3:latest","model":"qwen3:latest","size":5000000000,"details":{"family":"qwen3","parameter_size":"8.2B","quantization_level":"Q4_K_M"}},
        {"name":"gemma3:latest","model":"gemma3:latest","details":{"family":"gemma3","parameter_size":"4.3B"}},
        {"name":"nomic-embed-text:latest","model":"nomic-embed-text:latest","details":{"family":"nomic-bert"}},
        {"name":"bad name","model":"bad name"}]}"#;
    let t = parse_tags(tags).unwrap();
    assert_eq!(
        t.iter().map(|m| m.name.as_str()).collect::<Vec<_>>(),
        vec!["gemma3:latest", "nomic-embed-text:latest", "qwen3:latest"]
    );
    assert!(parse_tags(b"nope").is_err());

    let show = parse_show(
        br#"{"capabilities":["completion","vision"],"model_info":{"general.architecture":"gemma3","gemma3.context_length":131072}}"#,
    );
    assert_eq!(show.context_length, Some(131_072));
    let gemma = ollama_descriptor(&t[0], &show);
    assert_eq!(gemma.label, "gemma3:latest · 4.3B");
    assert_eq!(gemma.provider_label, "gemma3");
    assert_eq!(gemma.input_modalities, vec!["text", "image"]);
    assert!(!gemma.supported_parameters.contains(&"tools".to_string()));
    assert_eq!(gemma.pricing.as_ref().unwrap().prompt.as_deref(), Some("0"));

    let qwen = ollama_descriptor(
        &t[2],
        &parse_show(br#"{"capabilities":["completion","tools","thinking"]}"#),
    );
    assert!(qwen.supported_parameters.contains(&"tools".to_string()));
    assert_eq!(qwen.input_modalities, vec!["text"]);
    assert!(qwen.reasoning.is_some());

    // an Ollama that does not say: everything stays unknown
    let unknown = ollama_descriptor(&t[2], &parse_show(b"{}"));
    assert!(unknown.input_modalities.is_empty() && unknown.supported_parameters.is_empty());
}

#[tokio::test]
async fn lists_local_models_with_show_and_splits_embedders() {
    let tags = r#"{"models":[{"name":"gemma3:latest","model":"gemma3:latest"},{"name":"nomic-embed-text:latest","model":"nomic-embed-text:latest"}]}"#;
    let replies = || {
        vec![
            reply("200 OK", "application/json", tags),
            reply(
                "200 OK",
                "application/json",
                r#"{"capabilities":["completion","vision"]}"#,
            ),
            reply(
                "200 OK",
                "application/json",
                r#"{"capabilities":["embedding"],"model_info":{"nomic-bert.context_length":2048}}"#,
            ),
        ]
    };
    let m = mock(replies());
    let c = Client::flavor_with_base(Flavor::Ollama, &m.base, false);
    let chat = c.compat_models(None).await.unwrap();
    assert_eq!(chat.len(), 1);
    assert_eq!(chat[0].id, "gemma3:latest");
    {
        let reqs = m.requests.lock().unwrap();
        assert!(reqs[0].starts_with("GET /api/tags "));
        assert!(reqs[1].starts_with("POST /api/show ") && reqs[1].contains("gemma3:latest"));
        assert!(reqs.iter().all(|r| !has_header(r, "authorization")));
    }
    let m2 = mock(replies());
    let c2 = Client::flavor_with_base(Flavor::Ollama, &m2.base, false);
    let emb = c2.compat_embedding_models(None).await.unwrap();
    assert_eq!(emb.len(), 1);
    assert_eq!(
        (emb[0].id.as_str(), emb[0].context_length),
        ("nomic-embed-text:latest", Some(2048))
    );
}

#[tokio::test]
async fn ollama_embeds_through_the_compat_endpoint_without_a_key() {
    let m = mock(vec![reply(
        "200 OK",
        "application/json",
        r#"{"object":"list","data":[{"object":"embedding","embedding":[0.25,0.5],"index":0}],"model":"nomic-embed-text:latest","usage":{"prompt_tokens":3,"total_tokens":3}}"#,
    )]);
    let c = Client::flavor_with_base(Flavor::Ollama, &m.base, false);
    let e = c
        .embed(None, "nomic-embed-text:latest", vec!["hello".into()])
        .await
        .unwrap();
    assert_eq!((e.dimensions, e.count, e.prompt_tokens), (2, 1, Some(3)));
    let sent = m.requests.lock().unwrap()[0].clone();
    assert!(sent.starts_with("POST /v1/embeddings "));
    assert!(!has_header(&sent, "authorization"));
    // OpenAI needs its key
    let o = Client::flavor_with_base(Flavor::OpenAi, &closed_base(), false);
    assert_eq!(
        o.embed(None, "text-embedding-3-small", vec!["x".into()])
            .await
            .unwrap_err()
            .code,
        "missing_key"
    );
}

#[tokio::test]
async fn openai_models_need_the_key() {
    let m = mock(vec![reply(
        "200 OK",
        "application/json",
        r#"{"data":[{"id":"gpt-4.1-mini"},{"id":"text-embedding-3-large"}]}"#,
    )]);
    let c = Client::flavor_with_base(Flavor::OpenAi, &m.base, false);
    assert_eq!(c.compat_models(None).await.unwrap_err().code, "missing_key");
    let list = c.compat_models(Some(KEY.into())).await.unwrap();
    assert_eq!(list.len(), 1);
    let sent = m.requests.lock().unwrap()[0].clone();
    assert!(sent.starts_with("GET /models "));
    assert!(has_header(&sent, "authorization"));
}

#[tokio::test]
async fn validate_maps_statuses_per_flavor() {
    let m = mock(vec![
        reply("200 OK", "application/json", r#"{"data":[]}"#),
        reply(
            "401 Unauthorized",
            "application/json",
            r#"{"error":{"message":"Incorrect API key provided","code":"invalid_api_key"}}"#,
        ),
        reply("429 Too Many Requests", "application/json", "{}"),
        reply("503 Service Unavailable", "text/plain", "busy"),
        reply("418 Teapot", "text/plain", "?"),
    ]);
    let c = Client::flavor_with_base(Flavor::OpenAi, &m.base, false);
    let v = c.validate(Some(KEY.into())).await;
    assert_eq!(
        (v.status.as_str(), v.message.as_str()),
        ("connected", "OpenAI accepted the API key.")
    );
    let v = c.validate(Some(KEY.into())).await;
    assert_eq!(
        (v.status.as_str(), v.message.as_str()),
        ("invalid_credentials", "OpenAI rejected the API key.")
    );
    assert_eq!(c.validate(Some(KEY.into())).await.status, "unavailable");
    assert_eq!(c.validate(Some(KEY.into())).await.status, "unavailable");
    assert_eq!(c.validate(Some(KEY.into())).await.status, "error");
    assert_eq!(c.validate(None).await.status, "missing_key");
    assert!(m.requests.lock().unwrap()[0].starts_with("GET /models "));

    let o = mock(vec![reply(
        "200 OK",
        "application/json",
        r#"{"version":"0.12.6"}"#,
    )]);
    let c = Client::flavor_with_base(Flavor::Ollama, &o.base, false);
    let v = c.validate(None).await;
    assert_eq!(
        (v.status.as_str(), v.message.as_str()),
        ("connected", "Ollama 0.12.6 is running on this PC.")
    );
    assert!(o.requests.lock().unwrap()[0].starts_with("GET /api/version "));
    let down = Client::flavor_with_base(Flavor::Ollama, &closed_base(), false);
    let v = down.validate(None).await;
    assert_eq!(
        (v.status.as_str(), v.message.as_str()),
        ("unavailable", "Ollama is not running on this PC.")
    );
}

#[test]
fn maps_openai_and_ollama_errors() {
    let quota = http_error(
        Flavor::OpenAi,
        429,
        br#"{"error":{"message":"You exceeded your current quota","type":"insufficient_quota","code":"insufficient_quota"}}"#,
    );
    assert_eq!(quota.code, "payment_required");
    assert_eq!(http_error(Flavor::OpenAi, 429, b"{}").code, "rate_limited");
    let missing = http_error(
        Flavor::Ollama,
        404,
        br#"{"error":{"message":"model nope not found, try pulling it first","type":"api_error"}}"#,
    );
    assert_eq!(missing.code, "model_unavailable");
    assert!(missing.message.contains("Ollama") && missing.message.contains("not found"));
    let native = http_error(Flavor::Ollama, 400, br#"{"error":"bad thing"}"#);
    assert!(native.message.contains("bad thing"));
    // OpenRouter keeps its own words
    assert_eq!(
        http_error(Flavor::OpenRouter, 503, b"{}").message,
        "No provider is available for this model right now."
    );
    assert_eq!(
        http_error(Flavor::OpenAi, 503, b"{}").message,
        "OpenAI is not available right now."
    );
}

#[test]
fn flavors_never_take_a_url_from_the_page() {
    let f = |s: &str| serde_json::from_str::<CompatFlavor>(s);
    assert_eq!(f("\"openai\"").unwrap().flavor(), Flavor::OpenAi);
    assert_eq!(f("\"ollama\"").unwrap().flavor(), Flavor::Ollama);
    for bad in [
        "\"openrouter\"",
        "\"http://127.0.0.1:11434\"",
        "\"https://evil.example/v1\"",
        "{\"base\":\"https://evil.example\"}",
        "\"OpenAI\"",
    ] {
        assert!(f(bad).is_err(), "{bad}");
    }
    // the bases are constants: HTTPS for OpenAI, the exact loopback for Ollama
    assert_eq!(Flavor::OpenAi.base(), "https://api.openai.com/v1");
    assert!(Flavor::OpenAi.https_only());
    assert_eq!(Flavor::Ollama.base(), "http://127.0.0.1:11434");
    assert!(!Flavor::Ollama.https_only());
    assert_eq!(
        Client::for_flavor(Flavor::OpenAi).base,
        "https://api.openai.com/v1"
    );
    assert_eq!(
        Client::for_flavor(Flavor::Ollama).base,
        "http://127.0.0.1:11434"
    );
    assert_eq!(Client::new().base, BASE);
    // a URL smuggled into the chat request is not a field: ignored, never used
    let r: ChatRequest = serde_json::from_value(serde_json::json!({
        "model": "gpt-4.1-mini",
        "messages": [{ "role": "user", "content": "hi" }],
        "baseUrl": "https://evil.example/v1"
    }))
    .unwrap();
    let body = build_body_for(Flavor::OpenAi, &r).unwrap();
    assert!(!body.to_string().contains("evil.example"));
    // run ids of the three hosts never collide
    let p = [Flavor::OpenRouter, Flavor::OpenAi, Flavor::Ollama].map(|f| f.run_prefix());
    assert!(p[0] != p[1] && p[1] != p[2] && p[0] != p[2]);
}

#[tokio::test]
async fn the_production_openai_client_refuses_plain_http() {
    let m = mock(vec![reply("200 OK", "application/json", "{}")]);
    let c = Client::flavor_with_base(Flavor::OpenAi, &m.base, Flavor::OpenAi.https_only());
    assert_eq!(c.validate(Some(KEY.into())).await.status, "unavailable");
}

#[tokio::test]
async fn ensure_answers_without_starting_anything_when_ollama_runs() {
    let m = mock(vec![reply(
        "200 OK",
        "application/json",
        r#"{"version":"0.12.6"}"#,
    )]);
    let c = Client::flavor_with_base(Flavor::Ollama, &m.base, false);
    let e = ensure_with(
        &c,
        || panic!("must not look for the program"),
        Duration::from_secs(1),
    )
    .await;
    assert_eq!(
        (e.status.as_str(), e.version.as_deref()),
        ("running", Some("0.12.6"))
    );

    let down = Client::flavor_with_base(Flavor::Ollama, &closed_base(), false);
    let e = ensure_with(&down, || None, Duration::from_secs(1)).await;
    assert_eq!(e.status, "not_installed");
    let missing = std::env::temp_dir().join("realmnest-no-such-ollama.exe");
    let e = ensure_with(&down, || Some(missing), Duration::from_secs(1)).await;
    assert_eq!(e.status, "failed");

    let other = mock(vec![reply("404 Not Found", "text/plain", "no")]);
    let c = Client::flavor_with_base(Flavor::Ollama, &other.base, false);
    let e = ensure_with(&c, || panic!("not Ollama"), Duration::from_secs(1)).await;
    assert_eq!(e.status, "failed");
}

#[test]
fn finds_ollama_only_at_fixed_places() {
    let root = std::env::temp_dir().join(format!("realmnest-ollama-find-{}", std::process::id()));
    let lad = root.join("lad");
    let exe_dir = lad.join("Programs").join("Ollama");
    std::fs::create_dir_all(&exe_dir).unwrap();
    std::fs::write(exe_dir.join("ollama.exe"), b"").unwrap();
    let on_path = root.join("bin");
    std::fs::create_dir_all(&on_path).unwrap();
    let exe = if cfg!(windows) {
        "ollama.exe"
    } else {
        "ollama"
    };
    std::fs::write(on_path.join(exe), b"").unwrap();

    assert_eq!(
        find_ollama_in(Some(lad.as_os_str()), None),
        Some(exe_dir.join("ollama.exe"))
    );
    let path = std::env::join_paths([PathBuf::from("relative-dir"), on_path.clone()]).unwrap();
    assert_eq!(find_ollama_in(None, Some(&path)), Some(on_path.join(exe)));
    // relative folders (the current directory) are never searched
    let rel = std::env::join_paths([PathBuf::from("bin")]).unwrap();
    assert_eq!(
        find_ollama_in(Some(OsStr::new("relative")), Some(&rel)),
        None
    );
    assert_eq!(find_ollama_in(None, None), None);
    let _ = std::fs::remove_dir_all(&root);
}
