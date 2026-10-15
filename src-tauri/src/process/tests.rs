//! Real child processes: node stands in for a CLI (skipped if node is missing).

use super::*;
use crate::programs::{HostProgram, Resolved};
use std::sync::mpsc;

const ECHO: &str = "process.stdin.setEncoding('utf8'); let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{ process.stdout.write('got:'+s+'\\n'); process.stderr.write('warn\\n'); process.exit(3); });";
const STREAM: &str = "let i=0; const t=setInterval(()=>{ process.stdout.write('line'+(i++)+'\\n'); if(i===3) clearInterval(t); },40);";
const HANG: &str = "process.stdout.write('started\\n'); setInterval(()=>{},1000);";
const TREE: &str = "const c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); process.stdout.write('child:'+c.pid+'\\n'); setInterval(()=>{},1000);";

const ENV: &str = "process.stdout.write('var:'+process.env.REALMNEST_TEST_VAR+'\\n');";

fn node() -> Option<PathBuf> {
    std::env::split_paths(&std::env::var_os("PATH")?)
        .map(|d| d.join(if cfg!(windows) { "node.exe" } else { "node" }))
        .find(|p| p.is_file())
}

/// `node -e <script>`, only for the scripts above: an allowlist like Claude's
struct NodeTest(PathBuf);
impl HostProgram for NodeTest {
    fn id(&self) -> &str {
        "node-test"
    }
    fn locate(&self) -> Option<Resolved> {
        Some(Resolved {
            command: self.0.clone(),
            prefix_args: vec![],
            path: self.0.display().to_string(),
            source: "test",
        })
    }
    fn check_args(&self, args: &[String]) -> Result<(), String> {
        match args {
            [e, s] if e == "-e" && [ECHO, STREAM, HANG, TREE, ENV].contains(&s.as_str()) => Ok(()),
            _ => Err("script not allowed".into()),
        }
    }
    /// like Claude's CLAUDE_CONFIG_DIR: one named variable, nothing else
    fn check_env(&self, env: &std::collections::BTreeMap<String, String>) -> Result<(), String> {
        match env.keys().find(|k| *k != "REALMNEST_TEST_VAR") {
            Some(k) => Err(format!("environment variable not allowed: {k}")),
            None => Ok(()),
        }
    }
    fn default_cwd(&self) -> PathBuf {
        std::env::temp_dir()
    }
}

struct Missing;
impl HostProgram for Missing {
    fn id(&self) -> &str {
        "missing"
    }
    fn locate(&self) -> Option<Resolved> {
        None
    }
    fn check_args(&self, _: &[String]) -> Result<(), String> {
        Ok(())
    }
}

struct Collect(Mutex<mpsc::Sender<ProcessMessage>>);
impl Sink for Collect {
    fn send(&self, m: ProcessMessage) {
        let _ = self.0.lock().unwrap().send(m);
    }
}

fn host() -> Option<ProcessHost> {
    Some(ProcessHost::new(vec![
        Arc::new(NodeTest(node()?)),
        Arc::new(Missing),
    ]))
}

fn req(program: &str, script: &str) -> RunRequest {
    RunRequest {
        program: program.into(),
        args: vec!["-e".into(), script.into()],
        stdin: None,
        cwd: None,
        env: None,
        timeout_ms: None,
    }
}

/// start a run; returns its id and a receiver of its messages
fn start(h: &ProcessHost, r: RunRequest) -> (String, mpsc::Receiver<ProcessMessage>) {
    let (tx, rx) = mpsc::channel();
    let id = h.start(r, Arc::new(Collect(Mutex::new(tx))));
    (id, rx)
}

/// wait for `end`, collecting stdout / stderr
fn finish(rx: &mpsc::Receiver<ProcessMessage>) -> (String, String, bool, ProcessEnd) {
    let (mut out, mut err, mut spawned) = (String::new(), String::new(), false);
    loop {
        match rx
            .recv_timeout(Duration::from_secs(20))
            .expect("run did not end")
        {
            ProcessMessage::Spawn => spawned = true,
            ProcessMessage::Out { d } => out += &d,
            ProcessMessage::Err { d } => err += &d,
            ProcessMessage::End { end } => return (out, err, spawned, end),
        }
    }
}

fn alive(pid: u32) -> bool {
    if cfg!(windows) {
        let out = Command::new("tasklist")
            .args(["/FI", &format!("PID eq {pid}"), "/NH"])
            .output()
            .unwrap();
        String::from_utf8_lossy(&out.stdout).contains(&pid.to_string())
    } else {
        Command::new("kill")
            .args(["-0", &pid.to_string()])
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }
}

#[test]
fn passes_stdin_streams_output_and_reports_the_exit_code() {
    let Some(h) = host() else { return };
    let mut r = req("node-test", ECHO);
    r.stdin = Some("hello".into());
    let (_, rx) = start(&h, r);
    let (out, err, spawned, end) = finish(&rx);
    assert!(spawned);
    assert_eq!(out, "got:hello\n");
    assert_eq!(err, "warn\n");
    assert_eq!(
        end,
        ProcessEnd::Exit {
            code: Some(3),
            signal: None
        }
    );
}

#[test]
fn output_arrives_while_the_process_runs() {
    let Some(h) = host() else { return };
    let (_, rx) = start(&h, req("node-test", STREAM));
    let mut lines = vec![];
    loop {
        match rx.recv_timeout(Duration::from_secs(20)).unwrap() {
            ProcessMessage::Out { d } => lines.push(d),
            ProcessMessage::End { .. } => break,
            _ => {}
        }
    }
    assert_eq!(lines, ["line0\n", "line1\n", "line2\n"]);
}

#[test]
fn timeout_kills_the_whole_tree() {
    let Some(h) = host() else { return };
    let mut r = req("node-test", TREE);
    r.timeout_ms = Some(1_500);
    let (_, rx) = start(&h, r);
    let (out, _, _, end) = finish(&rx);
    assert_eq!(end, ProcessEnd::Timeout { timeout_ms: 1_500 });
    let pid: u32 = out.trim().strip_prefix("child:").unwrap().parse().unwrap();
    let t0 = Instant::now();
    while alive(pid) && t0.elapsed() < Duration::from_secs(5) {
        thread::sleep(Duration::from_millis(100));
    }
    assert!(!alive(pid), "grandchild {pid} survived");
}

#[test]
fn cancel_by_id_stops_the_run_and_forgets_it() {
    let Some(h) = host() else { return };
    let (id, rx) = start(&h, req("node-test", HANG));
    // wait for the first output, then cancel through the registry
    loop {
        if let ProcessMessage::Out { .. } = rx.recv_timeout(Duration::from_secs(20)).unwrap() {
            break;
        }
    }
    assert_eq!(h.active(), vec![id.clone()]);
    assert!(h.cancel(&id));
    let (_, _, _, end) = finish(&rx);
    assert_eq!(end, ProcessEnd::Cancelled);
    assert!(h.active().is_empty());
    assert!(!h.cancel(&id), "finished runs cannot be cancelled again");
}

#[test]
fn concurrent_runs_have_their_own_ids() {
    let Some(h) = host() else { return };
    let (a, rxa) = start(&h, req("node-test", HANG));
    let (b, rxb) = start(&h, req("node-test", ECHO));
    assert_ne!(a, b);
    let (_, _, _, end_b) = finish(&rxb);
    assert!(matches!(end_b, ProcessEnd::Exit { .. }));
    assert!(h.cancel(&a));
    assert_eq!(finish(&rxa).3, ProcessEnd::Cancelled);
}

#[test]
fn kill_all_ends_every_run() {
    let Some(h) = host() else { return };
    let (_, rx1) = start(&h, req("node-test", HANG));
    let (_, rx2) = start(&h, req("node-test", HANG));
    thread::sleep(Duration::from_millis(300));
    h.kill_all();
    assert_eq!(finish(&rx1).3, ProcessEnd::Cancelled);
    assert_eq!(finish(&rx2).3, ProcessEnd::Cancelled);
}

#[test]
fn refuses_before_spawning() {
    let Some(h) = host() else { return };
    let denied = |r: RunRequest| {
        let (_, rx) = start(&h, r);
        match finish(&rx) {
            (
                _,
                _,
                false,
                ProcessEnd::SpawnError {
                    code: SpawnErrorCode::Denied,
                    ..
                },
            ) => true,
            other => panic!("expected a refusal, got {other:?}"),
        }
    };
    assert!(denied(req("cmd", "dir")));
    assert!(denied(req("node-test", "require('fs').rmSync('C:/')")));
    let mut r = req("node-test", ECHO);
    r.cwd = Some("relative/dir".into());
    assert!(denied(r));
    let mut r = req("node-test", ECHO);
    r.stdin = Some("x".repeat(MAX_STDIN_BYTES + 1));
    assert!(denied(r));
    assert!(h.active().is_empty());
}

#[test]
fn a_missing_program_is_not_found() {
    let Some(h) = host() else { return };
    let (_, rx) = start(&h, req("missing", ECHO));
    assert!(matches!(
        finish(&rx).3,
        ProcessEnd::SpawnError {
            code: SpawnErrorCode::NotFound,
            ..
        }
    ));
    assert_eq!(
        h.locate("missing"),
        ProgramLocation {
            found: false,
            path: None,
            source: None
        }
    );
    assert!(h.locate("node-test").found);
    assert!(!h.locate("unknown").found);
}

#[test]
fn allowed_environment_reaches_the_child_and_anything_else_is_refused() {
    let Some(h) = host() else { return };
    let mut r = req("node-test", ENV);
    r.env = Some([("REALMNEST_TEST_VAR".to_string(), "hello".to_string())].into());
    let (_, rx) = start(&h, r);
    let (out, _, _, end) = finish(&rx);
    assert_eq!(out, "var:hello\n");
    assert_eq!(
        end,
        ProcessEnd::Exit {
            code: Some(0),
            signal: None
        }
    );

    let mut r = req("node-test", ENV);
    r.env = Some([("PATH".to_string(), "evil".to_string())].into());
    let (_, rx) = start(&h, r);
    assert!(matches!(
        finish(&rx),
        (
            _,
            _,
            false,
            ProcessEnd::SpawnError {
                code: SpawnErrorCode::Denied,
                ..
            }
        )
    ));
}

#[test]
fn output_lines_are_capped() {
    let data = format!("short\n{}\nafter\nlast", "x".repeat(100));
    let mut r = std::io::BufReader::with_capacity(16, data.as_bytes());
    let mut buf = Vec::new();
    assert_eq!(read_line_capped(&mut r, &mut buf, 50).unwrap(), (6, false));
    assert_eq!(buf, b"short\n");
    // too long: skipped whole, nothing kept
    assert_eq!(read_line_capped(&mut r, &mut buf, 50).unwrap(), (101, true));
    assert!(buf.is_empty());
    assert_eq!(read_line_capped(&mut r, &mut buf, 50).unwrap(), (6, false));
    assert_eq!(buf, b"after\n");
    assert_eq!(read_line_capped(&mut r, &mut buf, 50).unwrap(), (4, false));
    assert_eq!(buf, b"last");
    assert_eq!(read_line_capped(&mut r, &mut buf, 50).unwrap().0, 0);
}

#[test]
fn readers_are_not_waited_for_forever() {
    let (tx, rx) = mpsc::channel::<()>();
    let stuck = thread::spawn(move || {
        let _ = rx.recv();
    });
    let done = thread::spawn(|| {});
    let t = Instant::now();
    join_for([done, stuck], Duration::from_millis(200));
    assert!(t.elapsed() < Duration::from_secs(3));
    drop(tx);
}

#[test]
fn claude_runs_only_in_realmnests_own_folder() {
    let h = ProcessHost::new(vec![Arc::new(crate::programs::claude::Claude)]);
    let args: Vec<String> = [
        "-p",
        "--output-format",
        "stream-json",
        "--setting-sources",
        "user",
        "--tools",
        "",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect();
    let r = RunRequest {
        program: "claude".into(),
        args,
        stdin: Some("hi".into()),
        cwd: Some(std::env::temp_dir().display().to_string()),
        env: None,
        timeout_ms: None,
    };
    let (_, rx) = start(&h, r);
    let (_, _, spawned, end) = finish(&rx);
    assert!(!spawned);
    assert!(
        matches!(&end, ProcessEnd::SpawnError { code: SpawnErrorCode::Denied, message } if message.contains("own folder")),
        "{end:?}"
    );
}
