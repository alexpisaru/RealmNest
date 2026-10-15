//! The MCP stdio host with real processes: node plays a tiny MCP server
//! (skipped if node is missing). The protocol is tested in TypeScript.

use super::*;
use std::sync::atomic::AtomicUsize;
use std::sync::mpsc;

/// answers every request line with {"jsonrpc":"2.0","id":<id>,"result":{"echo":<method>,"secret":$TOKEN}};
/// "crash" exits with 3, "junk" prints a non-JSON line, "big" prints a huge line
const SERVER: &str = r#"
const rl = require('readline').createInterface({ input: process.stdin });
process.stderr.write('ready ' + (process.env.MCP_TOKEN || '-') + '\n');
rl.on('line', (l) => {
  const m = JSON.parse(l);
  if (m.method === 'crash') process.exit(3);
  if (m.method === 'junk') { process.stdout.write('this is not json\n'); return; }
  if (m.method === 'big') { process.stdout.write('"' + 'x'.repeat(17 * 1024 * 1024) + '"\n'); return; }
  if (m.method === 'tree') { const c = require('child_process').spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' }); process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: { child: c.pid } }) + '\n'); return; }
  if (m.id !== undefined) process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: { echo: m.method, secret: process.env.MCP_TOKEN || null, plain: process.env.PLAIN || null } }) + '\n');
});
rl.on('close', () => process.exit(0));
"#;

fn node() -> Option<PathBuf> {
    std::env::split_paths(&std::env::var_os("PATH")?)
        .map(|d| d.join(if cfg!(windows) { "node.exe" } else { "node" }))
        .find(|p| p.is_file())
}

fn script_dir() -> PathBuf {
    let d = std::env::temp_dir().join(format!("realmnest-mcp-test-{}", std::process::id()));
    std::fs::create_dir_all(&d).unwrap();
    std::fs::write(d.join("server.js"), SERVER).unwrap();
    d
}

struct Answer {
    yes: bool,
    asked: AtomicUsize,
}
impl Confirm for Answer {
    fn confirm(&self, _: &Prepared) -> bool {
        self.asked.fetch_add(1, Ordering::SeqCst);
        self.yes
    }
}

struct FakeSecrets;
impl Secrets for FakeSecrets {
    fn read(&self, name: &str) -> Result<Option<String>, String> {
        Ok((name == "mcp.srv1.MCP_TOKEN").then(|| "tok-very-secret-123".to_string()))
    }
    fn write(&self, _: &str, _: &str) -> Result<(), String> {
        Ok(())
    }
}

struct Collect(Mutex<mpsc::Sender<McpEvent>>);
impl McpSink for Collect {
    fn send(&self, e: McpEvent) {
        let _ = self.0.lock().unwrap().send(e);
    }
}

fn host(yes: bool) -> (McpHost, Arc<Answer>) {
    let answer = Arc::new(Answer {
        yes,
        asked: AtomicUsize::new(0),
    });
    (
        McpHost::new(
            TrustStore::load(None),
            answer.clone(),
            Arc::new(FakeSecrets),
        ),
        answer,
    )
}

fn launch(node: &Path, dir: &Path) -> Launch {
    Launch {
        server_id: "srv1".into(),
        command: node.display().to_string(),
        args: vec![dir.join("server.js").display().to_string()],
        cwd: Some(dir.display().to_string()),
        env: BTreeMap::from([("PLAIN".to_string(), "visible".to_string())]),
        secret_env: BTreeMap::new(),
    }
}

fn start(h: &McpHost, l: Launch) -> mpsc::Receiver<McpEvent> {
    let (tx, rx) = mpsc::channel();
    h.start(l, Arc::new(Collect(Mutex::new(tx))));
    rx
}

fn next(rx: &mpsc::Receiver<McpEvent>, want: impl Fn(&McpEvent) -> bool) -> McpEvent {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let left = deadline.saturating_duration_since(Instant::now());
        let e = rx.recv_timeout(left).expect("event in time");
        if want(&e) {
            return e;
        }
    }
}

fn request(id: u64, method: &str) -> Value {
    serde_json::json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": {} })
}

#[test]
fn refuses_bad_launches_before_anything_runs() {
    let dir = script_dir();
    let exe = node().unwrap_or_else(|| PathBuf::from("C:\\missing\\node.exe"));
    let base = launch(&exe, &dir);
    let with = |f: &dyn Fn(&mut Launch)| {
        let mut l = base.clone();
        f(&mut l);
        prepare(&l).err().map(|r| r.reason)
    };
    assert_eq!(
        with(&|l| l.command = "relative\\node.exe".into()),
        Some("refused")
    );
    assert_eq!(
        with(&|l| l.command = "C:\\nope\\nothing.exe".into()),
        Some("not_found")
    );
    assert_eq!(
        with(&|l| l.command = "surely-not-a-program-xyz".into()),
        Some("not_found")
    );
    assert_eq!(with(&|l| l.server_id = "../x".into()), Some("refused"));
    assert_eq!(with(&|l| l.args = vec!["a\nb".into()]), Some("refused"));
    assert_eq!(with(&|l| l.args = vec!["a".into(); 65]), Some("refused"));
    assert_eq!(with(&|l| l.cwd = Some("relative".into())), Some("refused"));
    assert_eq!(
        with(&|l| l.cwd = Some("C:\\definitely\\not\\here".into())),
        Some("refused")
    );
    assert_eq!(
        with(&|l| {
            l.env.insert("BAD-NAME".into(), "x".into());
        }),
        Some("refused")
    );
    // another secret (an AI connection's key) can never be poured into a server
    assert_eq!(
        with(&|l| {
            l.secret_env
                .insert("KEY".into(), "conn.openrouter-1.apiKey".into());
        }),
        Some("refused")
    );
    assert_eq!(
        with(&|l| {
            l.secret_env.insert("PLAIN".into(), "mcp.srv1.PLAIN".into());
        }),
        Some("refused")
    );
    if cfg!(windows) {
        // scripts would run through cmd.exe: refused
        let cmd = dir.join("server.cmd");
        std::fs::write(&cmd, "@echo off\r\n").unwrap();
        assert_eq!(
            with(&|l| l.command = cmd.display().to_string()),
            Some("refused")
        );
    }
    if node().is_some() {
        assert!(prepare(&base).is_ok());
        // a bare name is found on PATH and becomes an absolute path
        let mut by_name = base.clone();
        by_name.command = "node".into();
        assert!(prepare(&by_name).unwrap().executable.is_absolute());
    }
}

#[test]
fn only_json_rpc_goes_to_a_server() {
    assert!(check_outgoing(&request(1, "tools/list")).is_ok());
    assert!(check_outgoing(&serde_json::json!({"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":1}})).is_ok());
    assert!(check_outgoing(&serde_json::json!({"jsonrpc":"2.0","id":7,"result":{}})).is_ok());
    assert!(
        check_outgoing(&serde_json::json!({"jsonrpc":"2.0","id":7,"method":"x","result":{}}))
            .is_err()
    );
    assert!(check_outgoing(&serde_json::json!({"jsonrpc":"1.0","id":1,"method":"x"})).is_err());
    assert!(check_outgoing(&serde_json::json!([1, 2])).is_err());
    assert!(check_outgoing(&serde_json::json!({"jsonrpc":"2.0","id":1})).is_err());
    assert!(
        check_outgoing(&serde_json::json!({"jsonrpc":"2.0","id":1,"result":{},"error":{}}))
            .is_err()
    );
}

#[test]
fn lines_are_capped() {
    let data = format!("{}\nok\n", "x".repeat(MAX_LINE_BYTES + 10));
    let mut r = BufReader::new(data.as_bytes());
    let mut buf = Vec::new();
    let (n, too_long) = read_line_capped(&mut r, &mut buf).unwrap();
    assert!(too_long && n == MAX_LINE_BYTES + 11 && buf.is_empty());
    let (_, too_long) = read_line_capped(&mut r, &mut buf).unwrap();
    assert!(!too_long && buf == b"ok\n");
}

#[test]
fn asks_once_then_runs_talks_and_stops() {
    let Some(node) = node() else { return };
    let dir = script_dir();
    let (h, answer) = host(true);
    let rx = start(&h, launch(&node, &dir));
    assert!(matches!(
        next(&rx, |e| matches!(e, McpEvent::Started { .. })),
        McpEvent::Started { .. }
    ));
    assert_eq!(answer.asked.load(Ordering::SeqCst), 1);
    h.send("srv1", &request(1, "tools/list")).unwrap();
    let m = next(&rx, |e| matches!(e, McpEvent::Message { .. }));
    let McpEvent::Message { message, .. } = m else {
        unreachable!()
    };
    assert_eq!(message["result"]["echo"], "tools/list");
    assert_eq!(message["result"]["plain"], "visible");
    // a line that is not JSON is reported, the server keeps going
    h.send("srv1", &request(2, "junk")).unwrap();
    assert!(matches!(
        next(&rx, |e| !matches!(e, McpEvent::Stderr { .. })),
        McpEvent::Invalid { .. }
    ));
    // invalid outgoing messages never reach it
    assert!(h.send("srv1", &serde_json::json!({"x": 1})).is_err());
    assert!(h.send("nope", &request(3, "x")).is_err());
    h.stop("srv1");
    let exit = next(&rx, |e| matches!(e, McpEvent::Exit { .. }));
    assert_eq!(
        exit,
        McpEvent::Exit {
            reason: "stopped",
            code: Some(0),
            message: None
        }
    );
    assert!(h.running().is_empty());
    // the same launch is remembered: no second question
    let rx = start(&h, launch(&node, &dir));
    next(&rx, |e| matches!(e, McpEvent::Started { .. }));
    assert_eq!(answer.asked.load(Ordering::SeqCst), 1);
    // a changed launch is a new question
    h.kill_all();
    next(&rx, |e| matches!(e, McpEvent::Exit { .. }));
    let mut changed = launch(&node, &dir);
    changed.env.insert("PLAIN".into(), "other".into());
    let rx = start(&h, changed);
    next(&rx, |e| matches!(e, McpEvent::Started { .. }));
    assert_eq!(answer.asked.load(Ordering::SeqCst), 2);
    h.kill_all();
    assert!(matches!(
        next(&rx, |e| matches!(e, McpEvent::Exit { .. })),
        McpEvent::Exit {
            reason: "killed",
            ..
        }
    ));
}

#[test]
fn a_no_starts_nothing() {
    let Some(node) = node() else { return };
    let dir = script_dir();
    let (h, _) = host(false);
    let rx = start(&h, launch(&node, &dir));
    let first = rx.recv_timeout(Duration::from_secs(5)).unwrap();
    assert!(matches!(
        first,
        McpEvent::Exit {
            reason: "declined",
            ..
        }
    ));
    assert!(h.running().is_empty());
}

#[test]
fn secrets_reach_the_process_and_are_redacted_on_the_way_back() {
    let Some(node) = node() else { return };
    let dir = script_dir();
    let (h, _) = host(true);
    let mut l = launch(&node, &dir);
    l.secret_env
        .insert("MCP_TOKEN".into(), "mcp.srv1.MCP_TOKEN".into());
    let rx = start(&h, l);
    let line = next(&rx, |e| matches!(e, McpEvent::Stderr { .. }));
    assert_eq!(
        line,
        McpEvent::Stderr {
            line: "ready [secret]".into()
        }
    );
    h.send("srv1", &request(1, "x")).unwrap();
    let McpEvent::Message { message, .. } = next(&rx, |e| matches!(e, McpEvent::Message { .. }))
    else {
        unreachable!()
    };
    assert_eq!(message["result"]["secret"], "[secret]");
    h.kill_all();
    next(&rx, |e| matches!(e, McpEvent::Exit { .. }));

    // no value stored: it does not start
    let mut l = launch(&node, &dir);
    l.server_id = "srv2".into();
    l.secret_env
        .insert("MCP_TOKEN".into(), "mcp.srv2.MCP_TOKEN".into());
    let rx = start(&h, l);
    assert!(matches!(
        rx.recv_timeout(Duration::from_secs(5)).unwrap(),
        McpEvent::Exit {
            reason: "missing_secret",
            ..
        }
    ));
}

#[test]
fn a_crash_is_reported_and_oversized_lines_are_refused() {
    let Some(node) = node() else { return };
    let dir = script_dir();
    let (h, _) = host(true);
    let rx = start(&h, launch(&node, &dir));
    next(&rx, |e| matches!(e, McpEvent::Started { .. }));
    h.send("srv1", &request(1, "big")).unwrap();
    let e = next(&rx, |e| matches!(e, McpEvent::Invalid { .. }));
    assert!(matches!(e, McpEvent::Invalid { ref reason, .. } if reason.contains("longer")));
    h.send("srv1", &request(2, "crash")).unwrap();
    let exit = next(&rx, |e| matches!(e, McpEvent::Exit { .. }));
    assert_eq!(
        exit,
        McpEvent::Exit {
            reason: "exited",
            code: Some(3),
            message: None
        }
    );
    assert!(h.running().is_empty());
    assert!(h.send("srv1", &request(3, "x")).is_err());
}

#[cfg(windows)]
#[test]
fn stopping_kills_what_the_server_started() {
    let Some(node) = node() else { return };
    let dir = script_dir();
    let (h, _) = host(true);
    let rx = start(&h, launch(&node, &dir));
    next(&rx, |e| matches!(e, McpEvent::Started { .. }));
    h.send("srv1", &request(1, "tree")).unwrap();
    let McpEvent::Message { message, .. } = next(&rx, |e| matches!(e, McpEvent::Message { .. }))
    else {
        unreachable!()
    };
    let child = message["result"]["child"].as_u64().unwrap() as u32;
    h.stop("srv1");
    next(&rx, |e| matches!(e, McpEvent::Exit { .. }));
    thread::sleep(Duration::from_millis(300));
    let out = Command::new("tasklist")
        .args(["/FI", &format!("PID eq {child}"), "/NH"])
        .output()
        .unwrap();
    assert!(
        !String::from_utf8_lossy(&out.stdout).contains(&child.to_string()),
        "grandchild still alive"
    );
}

/// a pipe whose reader never reads: every write blocks until the test lets go
struct Stuck(mpsc::Receiver<()>);
impl Write for Stuck {
    fn write(&mut self, _: &[u8]) -> std::io::Result<usize> {
        let _ = self.0.recv();
        Err(std::io::ErrorKind::BrokenPipe.into())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

#[test]
fn a_server_that_stops_reading_cannot_block_a_send() {
    let (release, rx) = mpsc::channel();
    let tx = spawn_writer(Stuck(rx));
    let started = Instant::now();
    let mut result = Ok(());
    // one line is in the stuck write, the queue holds SEND_QUEUE more: the next one cannot wait forever
    for _ in 0..SEND_QUEUE + 2 {
        result = queue_line(&tx, b"{}\n".to_vec(), Duration::from_millis(200));
        if result.is_err() {
            break;
        }
    }
    assert!(result.unwrap_err().contains("not reading"));
    assert!(started.elapsed() < Duration::from_secs(3));
    // once the writer gives up, sends fail at once instead of waiting
    drop(release);
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        let r = queue_line(&tx, b"{}\n".to_vec(), Duration::from_millis(10));
        if matches!(&r, Err(e) if e.contains("closed")) {
            break;
        }
        assert!(Instant::now() < deadline, "the writer never stopped");
    }
}

fn prepared(args: Vec<String>, env: &[(&str, &str)], secrets: &[&str]) -> Prepared {
    Prepared {
        executable: PathBuf::from("C:\\Tools\\server.exe"),
        args,
        cwd: PathBuf::from("C:\\Tools"),
        env: env
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect(),
        secret_names: secrets.iter().map(|s| s.to_string()).collect(),
    }
}

#[test]
fn the_consent_text_shows_everything_that_decides_what_runs() {
    let long_arg = format!("--config={}", "a".repeat(600));
    let p = prepared(
        vec![
            long_arg.clone(),
            "evil\u{202E}txt.exe".into(),
            "tab\there".into(),
        ],
        &[
            ("NODE_OPTIONS", "--require C:\\evil.js"),
            ("LOG_LEVEL", "debug"),
            ("GITHUB_TOKEN", "ghp_abcdefghijklmnopqrstuvwxyz0123456789"),
            ("SOME_VALUE", "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZmdo"),
        ],
        &["API_TOKEN"],
    );
    let text = consent_text(&p).unwrap();
    // arguments in full, invisible characters made visible
    assert!(text.contains(&long_arg));
    assert!(text.contains("evil\\u{202E}txt.exe") && !text.contains('\u{202E}'));
    assert!(text.contains("tab\\u{0009}here"));
    // values shown; credentials masked; secret variables never shown
    assert!(text.contains("LOG_LEVEL = debug"));
    assert!(!text.contains("ghp_abcdef") && text.contains("GITHUB_TOKEN = ••••••"));
    assert!(!text.contains("Zm9vYmFy"));
    assert!(text.contains("API_TOKEN = (segreto dal portachiavi, nascosto)"));
    // a variable that changes what code runs: in full, with a warning
    assert!(text.contains("NODE_OPTIONS = --require C:\\evil.js"));
    assert!(text.contains("ATTENZIONE: NODE_OPTIONS"));
    // a launch that would not fit on screen is refused, never shown in part
    let too_long = prepared(vec!["x".repeat(MAX_ARG_LEN); 2], &[], &[]);
    assert_eq!(consent_text(&too_long).unwrap_err().reason, "refused");
    let many: Vec<(String, String)> = (0..MAX_CONSENT_LINES)
        .map(|i| (format!("V{i}"), "1".to_string()))
        .collect();
    let many_ref: Vec<(&str, &str)> = many.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect();
    assert!(consent_text(&prepared(vec![], &many_ref, &[])).is_err());
}

#[test]
fn risky_variables_are_never_secret() {
    for n in [
        "NODE_OPTIONS",
        "path",
        "PYTHONPATH",
        "PYTHONSTARTUP",
        "PYTHONHOME",
        "PERL5OPT",
        "RUBYOPT",
        "ComSpec",
        "LD_PRELOAD",
        "DYLD_INSERT_LIBRARIES",
    ] {
        assert!(is_risky_env(n), "{n}");
    }
    assert!(!is_risky_env("LOG_LEVEL") && !is_risky_env("XPATH"));
    let dir = script_dir();
    let exe = node().unwrap_or_else(|| PathBuf::from("C:\\missing\\node.exe"));
    if node().is_some() {
        let mut l = launch(&exe, &dir);
        l.secret_env
            .insert("NODE_OPTIONS".into(), "mcp.srv1.NODE_OPTIONS".into());
        assert_eq!(prepare(&l).unwrap_err().reason, "refused");
    }
}

#[test]
fn secrets_are_redacted_in_every_json_form() {
    let forms = redaction_forms(vec!["p\"a\\ss/word".into(), "abc".into()]);
    // the JSON-escaped form is caught too; values shorter than 4 are not redacted
    assert!(forms.contains(&"p\\\"a\\\\ss/word".to_string()));
    assert!(!forms.contains(&"abc".to_string()));
    let line = r#"{"a":"x p\"a\\ss/word y","b":["p\"a\\ss\/word"]}"#;
    let mut v: Value = serde_json::from_str(&redact_text(line, &forms)).unwrap();
    redact_value(&mut v, &forms);
    assert_eq!(v["a"], "x [secret] y");
    assert_eq!(v["b"][0], "[secret]");
}
