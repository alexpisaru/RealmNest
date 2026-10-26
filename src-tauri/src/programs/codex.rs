//! Codex CLI (OpenAI), as the desktop host runs it for the ChatGPT provider: the user's
//! ChatGPT subscription, signed in through Codex's own login. Mirrors
//! `src/runtime/providers/codex/host.ts` (discovery, environment) and `args.ts` (allowlist);
//! `args.cases.json` keeps the two allowlists identical. Checked against Codex CLI 0.162.1.
//!
//! Every turn runs `codex exec --json … -` with the prompt on stdin, read-only, without the
//! user's config.toml, and with all of Codex's own tools switched off: RealmNest has its own
//! tools and approvals. A one-off search turn may use OpenAI's web search and nothing else.
//! The allowlist does not only permit those switches, it requires them.

use super::{home_dir, HostProgram, Resolved};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

pub const ID: &str = "codex";

#[cfg(windows)]
const EXE: &str = "codex.exe";
#[cfg(not(windows))]
const EXE: &str = "codex";

pub struct Codex;

impl HostProgram for Codex {
    fn id(&self) -> &str {
        ID
    }
    fn locate(&self) -> Option<Resolved> {
        locate(&|k| std::env::var(k).ok())
    }
    fn check_args(&self, args: &[String]) -> Result<(), String> {
        check_args(args)
    }
    fn check_env(&self, env: &std::collections::BTreeMap<String, String>) -> Result<(), String> {
        check_env(env)
    }
    fn env(&self, base: Vec<(String, String)>) -> Vec<(String, String)> {
        let mut env: Vec<(String, String)> = base
            .into_iter()
            .filter(|(k, _)| !is_dropped_var(k) && k != LOG_ENV)
            .collect();
        env.push((LOG_ENV.into(), RETRY_LOG.into()));
        env
    }
    fn default_cwd(&self) -> PathBuf {
        default_cwd()
    }
    fn expand_args(&self, args: &[String]) -> Result<Vec<String>, String> {
        expand_bridge(
            args,
            &|p| std::fs::read(p).map_err(|e| e.to_string()),
            std::env::current_exe().ok().as_deref(),
        )
    }
}

// ── RealmNest tools: the RealmNest MCP bridge ──────────────

/// `--realmnest-bridge <config>`: a bridge session's config (RealmNest's own folder), expanded here
pub const BRIDGE_FLAG: &str = "--realmnest-bridge";
/// Codex calls MCP tools and its web search through its code-mode host: on only for bridge and
/// search turns (with the shell, unified exec, view_image and every other tool still off, it can
/// call nothing but RealmNest, or the web search)
pub const BRIDGE_NEEDS: &str = "code_mode_host";

fn toml_str(v: &str) -> String {
    let mut out = String::from('"');
    for c in v.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            c if (c as u32) < 0x20 || c == '\u{7f}' => {
                out.push_str(&format!("\\u{:04x}", c as u32))
            }
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

/// Replaces `--realmnest-bridge <config>` with Codex's settings for RealmNest's MCP server: the
/// relay (this executable, `--mcp-bridge`), its session address and token, RealmNest deciding the
/// approvals (Codex's own prompt would block a non-interactive turn), and a long tool timeout
/// (RealmNest may wait for the user). The config must be the bridge's own file, naming this exe.
pub fn expand_bridge(
    args: &[String],
    read: &dyn Fn(&std::path::Path) -> Result<Vec<u8>, String>,
    exe: Option<&std::path::Path>,
) -> Result<Vec<String>, String> {
    let Some(at) = args.iter().position(|a| a == BRIDGE_FLAG) else {
        return Ok(args.to_vec());
    };
    let path = args.get(at + 1).ok_or("the bridge config is missing")?;
    if !crate::programs::claude::is_bridge_config(path) {
        return Err("not a RealmNest bridge config".into());
    }
    let bytes = read(std::path::Path::new(path))?;
    if bytes.len() > 16 * 1024 {
        return Err("the bridge config is too large".into());
    }
    let v: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|_| "unreadable bridge config".to_string())?;
    let s = &v["mcpServers"][crate::mcp::bridge::SERVER_NAME];
    let command = s["command"]
        .as_str()
        .ok_or("the bridge config has no command")?;
    if s["args"] != serde_json::json!(["--mcp-bridge"]) {
        return Err("unexpected bridge arguments".into());
    }
    // the relay is RealmNest itself
    if let Some(exe) = exe {
        if std::path::Path::new(command) != exe {
            return Err("the bridge must run RealmNest itself".into());
        }
    }
    let addr = s["env"][crate::mcp::bridge::ADDR_ENV]
        .as_str()
        .ok_or("no bridge address")?;
    let token = s["env"][crate::mcp::bridge::TOKEN_ENV]
        .as_str()
        .ok_or("no bridge token")?;
    let ok_addr = addr
        .parse::<std::net::SocketAddr>()
        .is_ok_and(|a| a.ip().is_loopback());
    let ok_token = !token.is_empty()
        && token.len() <= 128
        && token
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
    if !ok_addr || !ok_token {
        return Err("invalid bridge session".into());
    }
    let name = crate::mcp::bridge::SERVER_NAME;
    let settings = [
        format!("mcp_servers.{name}.command={}", toml_str(command)),
        format!("mcp_servers.{name}.args=[\"--mcp-bridge\"]"),
        format!(
            "mcp_servers.{name}.env={{ {} = {}, {} = {} }}",
            crate::mcp::bridge::ADDR_ENV,
            toml_str(addr),
            crate::mcp::bridge::TOKEN_ENV,
            toml_str(token)
        ),
        format!("mcp_servers.{name}.default_tools_approval_mode=\"approve\""),
        format!("mcp_servers.{name}.startup_timeout_sec=30"),
        format!("mcp_servers.{name}.tool_timeout_sec=900"),
    ];
    let mut out: Vec<String> = args[..at].to_vec();
    for s in settings {
        out.push("-c".into());
        out.push(s);
    }
    out.extend_from_slice(&args[at + 2..]);
    Ok(out)
}

/// an empty folder owned by RealmNest: no project AGENTS.md or git repository by accident
pub fn default_cwd() -> PathBuf {
    home_dir().join(".nestra").join("codex")
}

// ── allowlist ──────────────────────────────────────────────

/// Codex features switched off on every turn (its shell, apps, browser, computer use,
/// plugins, sub-agents, image tools, hooks…). Same list as `DISABLED_FEATURES` in args.ts.
pub const DISABLED_FEATURES: [&str; 19] = [
    "shell_tool",
    "apps",
    "browser_use",
    "browser_use_external",
    "computer_use",
    "in_app_browser",
    "plugins",
    "remote_plugin",
    "sleep_tool",
    "goals",
    "code_mode_host",
    "image_generation",
    "unified_exec",
    "multi_agent",
    "view_image",
    "hooks",
    "tool_suggest",
    "skill_search",
    "skill_mcp_dependency_install",
];

/// Codex's own web search: off on every turn but a search turn
pub const WEB_SEARCH_OFF: &str = "web_search=\"disabled\"";
/// a one-off search turn (no session, no RealmNest tools): OpenAI's live search and nothing else
pub const WEB_SEARCH_LIVE: &str = "web_search=\"live\"";
/// the caller's system prompt, as a TOML basic string
pub const INSTRUCTIONS_KEY: &str = "developer_instructions";
/// UTF-16 code units of the whole TOML string (quotes and escapes included)
pub const MAX_INSTRUCTIONS: usize = 20_000;
/// the reasoning effort, as `model_reasoning_effort="<level>"`
pub const EFFORT_KEY: &str = "model_reasoning_effort";
/// the levels RealmNest may ask for (CODEX_EFFORTS in args.ts); never "ultra", which needs
/// Codex's own task delegation (multi-agent is off on every turn)
pub const EFFORTS: [&str; 6] = ["minimal", "low", "medium", "high", "xhigh", "max"];

/// `model_reasoning_effort="<level>"` with one of EFFORTS, nothing else
fn is_effort_setting(v: &str) -> bool {
    v.strip_prefix(EFFORT_KEY)
        .and_then(|r| r.strip_prefix("=\""))
        .and_then(|r| r.strip_suffix('"'))
        .is_some_and(|level| EFFORTS.contains(&level))
}

fn is_uuid(v: &str) -> bool {
    let b = v.as_bytes();
    b.len() == 36
        && b.iter().enumerate().all(|(i, c)| match i {
            8 | 13 | 18 | 23 => *c == b'-',
            _ => c.is_ascii_hexdigit(),
        })
}

pub fn is_model(v: &str) -> bool {
    let mut chars = v.chars();
    matches!(chars.next(), Some(c) if c.is_ascii_alphanumeric())
        && v.chars().count() <= 80
        && chars.all(|c| c.is_ascii_alphanumeric() || "._:-".contains(c))
}

/// a TOML basic string ("…") as args.ts `tomlString` writes it: escapes only, no raw control characters
fn is_toml_string(v: &str) -> bool {
    let len = v.encode_utf16().count();
    if !(3..=MAX_INSTRUCTIONS).contains(&len) {
        return false;
    }
    let Some(inner) = v.strip_prefix('"').and_then(|s| s.strip_suffix('"')) else {
        return false;
    };
    let mut chars = inner.chars();
    while let Some(c) = chars.next() {
        match c {
            '"' => return false,
            '\\' => match chars.next() {
                Some('b' | 't' | 'n' | 'f' | 'r' | '"' | '\\') => {}
                Some('u') => {
                    let hex: String = chars.by_ref().take(4).collect();
                    if hex.len() != 4 || !hex.bytes().all(|b| b.is_ascii_hexdigit()) {
                        return false;
                    }
                    let n = u32::from_str_radix(&hex, 16).unwrap_or(0xD800);
                    if (0xD800..=0xDFFF).contains(&n) {
                        return false;
                    }
                }
                _ => return false,
            },
            c if (c as u32) < 0x20 || c == '\u{7f}' => return false,
            _ => {}
        }
    }
    true
}

/// Same rules as `checkCodexArgs` in args.ts.
pub fn check_args(args: &[String]) -> Result<(), String> {
    let exact: [&[&str]; 2] = [&["--version"], &["login", "status"]];
    if exact
        .iter()
        .any(|e| e.len() == args.len() && e.iter().zip(args).all(|(a, b)| a == b))
    {
        return Ok(());
    }
    if args.first().map(String::as_str) != Some("exec") {
        return Err("only codex exec is allowed".into());
    }
    let n = args.len();
    if n < 2 || args[n - 1] != "-" {
        return Err("the prompt must come from stdin (-)".into());
    }
    // `exec <options> resume <session id> -` continues a session
    let resume = n >= 4 && args[n - 3] == "resume";
    let opts = if resume {
        if !is_uuid(&args[n - 2]) {
            return Err("invalid session id".into());
        }
        &args[1..n - 3]
    } else {
        &args[1..n - 1]
    };
    let mut seen: Vec<&str> = Vec::new();
    let mut disabled: Vec<&str> = Vec::new();
    let mut config: Vec<&str> = Vec::new();
    let mut live_search = false;
    let mut i = 0;
    while i < opts.len() {
        let name = opts[i].as_str();
        let value = opts.get(i + 1).map(String::as_str);
        let mut takes_value = true;
        match name {
            "--json" | "--skip-git-repo-check" | "--ignore-user-config" | "--ephemeral" => {
                takes_value = false;
                if seen.contains(&name) {
                    return Err(format!("duplicate flag: {name}"));
                }
                seen.push(name);
            }
            "-s" | "-m" => {
                if seen.contains(&name) {
                    return Err(format!("duplicate flag: {name}"));
                }
                seen.push(name);
                let ok = match name {
                    "-s" => value == Some("read-only"),
                    _ => value.is_some_and(is_model),
                };
                if !ok {
                    return Err(format!("invalid value for {name}"));
                }
            }
            BRIDGE_FLAG => {
                if seen.contains(&name) {
                    return Err(format!("duplicate flag: {name}"));
                }
                seen.push(name);
                if !value.is_some_and(crate::programs::claude::is_bridge_config) {
                    return Err("invalid value for --realmnest-bridge".into());
                }
            }
            "--disable" => {
                let Some(f) = value.filter(|v| DISABLED_FEATURES.contains(v)) else {
                    return Err("invalid value for --disable".into());
                };
                if disabled.contains(&f) {
                    return Err(format!("duplicate --disable {f}"));
                }
                disabled.push(f);
            }
            "-c" => {
                if value == Some(WEB_SEARCH_LIVE) {
                    live_search = true;
                }
                let key = match value {
                    Some(WEB_SEARCH_OFF) | Some(WEB_SEARCH_LIVE) => "web_search",
                    Some(v)
                        if v.strip_prefix(INSTRUCTIONS_KEY)
                            .and_then(|r| r.strip_prefix('='))
                            .is_some_and(is_toml_string) =>
                    {
                        INSTRUCTIONS_KEY
                    }
                    Some(v) if is_effort_setting(v) => EFFORT_KEY,
                    _ => return Err("invalid value for -c".into()),
                };
                if config.contains(&key) {
                    return Err(format!("duplicate -c {key}"));
                }
                config.push(key);
            }
            _ => {
                return Err(format!(
                    "argument not allowed: {}",
                    name.chars().take(40).collect::<String>()
                ))
            }
        }
        i += if takes_value { 2 } else { 1 };
    }
    for required in [
        "--json",
        "--skip-git-repo-check",
        "--ignore-user-config",
        "-s",
    ] {
        if !seen.contains(&required) {
            return Err(format!("{required} is required"));
        }
    }
    if !config.contains(&"web_search") {
        return Err("the web search setting is required".into());
    }
    // a bridge turn keeps the code-mode host (Codex calls MCP tools through it); every other tool is off
    let bridge = seen.contains(&BRIDGE_FLAG);
    // live search only on a one-off search turn: no session, no RealmNest tools
    if live_search && (bridge || resume || !seen.contains(&"--ephemeral")) {
        return Err("web search is only for a one-off turn without RealmNest tools".into());
    }
    if bridge && disabled.contains(&BRIDGE_NEEDS) {
        return Err("a bridge turn needs the code-mode host".into());
    }
    // Codex's web search runs through the code-mode host too (with it off, a search turn hangs)
    if live_search && disabled.contains(&BRIDGE_NEEDS) {
        return Err("a search turn needs the code-mode host".into());
    }
    if let Some(f) = DISABLED_FEATURES
        .iter()
        .find(|f| !disabled.contains(f) && !((bridge || live_search) && **f == BRIDGE_NEEDS))
    {
        return Err(format!("Codex's own tools must be off (--disable {f})"));
    }
    if resume && seen.contains(&"--ephemeral") {
        return Err("a resumed session cannot be ephemeral".into());
    }
    Ok(())
}

// ── environment ────────────────────────────────────────────

/// The only variable a connection may set: its own Codex folder (a separate sign-in).
/// Same rule as `checkCodexEnv` in args.ts, plus the folder must exist.
pub const HOME_ENV: &str = "CODEX_HOME";

pub fn check_env(env: &std::collections::BTreeMap<String, String>) -> Result<(), String> {
    for (k, v) in env {
        if k != HOME_ENV {
            return Err(format!(
                "environment variable not allowed: {}",
                k.chars().take(40).collect::<String>()
            ));
        }
        check_home(v)?;
    }
    Ok(())
}

fn check_home(v: &str) -> Result<(), String> {
    let p = Path::new(v);
    if v.is_empty() || v.len() > 1024 || v.contains('\0') || !p.is_absolute() {
        return Err(format!("{HOME_ENV} must be an absolute folder path"));
    }
    if !p.is_dir() {
        return Err("the Codex folder does not exist".into());
    }
    Ok(())
}

/// Codex's log filter: always set, to exactly this. Codex reports a rate-limited request (429) and
/// its silent wait before retrying (often minutes) only in its log, never in the JSON events; this
/// puts that one warning on stderr, where the provider (src/runtime/providers/codex/parser.ts
/// `retryWait`) stops the turn instead of waiting. Same value as host.ts.
pub const LOG_ENV: &str = "RUST_LOG";
pub const RETRY_LOG: &str = "codex_core::responses_retry=warn";

/// Variables never passed on: those that tie a process to a running Codex session or sandbox
/// (RealmNest started from inside Codex), and API keys, so a turn always uses the ChatGPT
/// sign-in and never bills a key by surprise. Same list as host.ts.
pub fn is_dropped_var(k: &str) -> bool {
    matches!(
        k,
        "OPENAI_API_KEY"
            | "CODEX_API_KEY"
            | "CODEX_SANDBOX"
            | "CODEX_SANDBOX_NETWORK_DISABLED"
            | "CODEX_THREAD_ID"
            | "CODEX_SESSION_ID"
            | "CODEX_MANAGED_PACKAGE_ROOT"
            | "CODEX_INTERNAL_ORIGINATOR_OVERRIDE"
    ) || k.starts_with("CODEX_MANAGED_BY_")
}

// ── discovery ──────────────────────────────────────────────

fn is_file(p: &Path) -> bool {
    p.is_file()
}

fn direct(p: PathBuf, source: &'static str) -> Resolved {
    Resolved {
        path: p.display().to_string(),
        command: p,
        prefix_args: vec![],
        source,
    }
}

/// the npm platform package and target triple holding this machine's native binary (as codex.js picks it)
fn target() -> Option<(&'static str, &'static str)> {
    Some(match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => ("codex-win32-x64", "x86_64-pc-windows-msvc"),
        ("windows", "aarch64") => ("codex-win32-arm64", "aarch64-pc-windows-msvc"),
        ("macos", "x86_64") => ("codex-darwin-x64", "x86_64-apple-darwin"),
        ("macos", "aarch64") => ("codex-darwin-arm64", "aarch64-apple-darwin"),
        ("linux", "x86_64") => ("codex-linux-x64", "x86_64-unknown-linux-musl"),
        ("linux", "aarch64") => ("codex-linux-arm64", "aarch64-unknown-linux-musl"),
        _ => return None,
    })
}

/// The native binary inside an npm install of `@openai/codex` (the package folder): the npm
/// entry is a node script (codex.js) that only starts this binary, so we start it directly.
pub fn native_in_package(pkg_dir: &Path) -> Option<PathBuf> {
    let text = fs::read_to_string(pkg_dir.join("package.json")).ok()?;
    let pkg: serde_json::Value = serde_json::from_str(&text).ok()?;
    if pkg["name"].as_str() != Some("@openai/codex") {
        return None;
    }
    let (platform, triple) = target()?;
    [
        pkg_dir.join("node_modules").join("@openai").join(platform),
        // hoisted next to it: <prefix>/node_modules/@openai/<platform>
        pkg_dir.parent()?.join(platform),
        // older packages carried the binary themselves
        pkg_dir.to_path_buf(),
    ]
    .iter()
    .map(|d| d.join("vendor").join(triple).join("bin").join(EXE))
    .find(|p| is_file(p))
}

/// an npm global prefix on Windows (`<prefix>\codex.cmd` + `<prefix>\node_modules\@openai\codex`)
fn from_prefix(prefix: &Path) -> Option<PathBuf> {
    native_in_package(&prefix.join("node_modules").join("@openai").join("codex"))
}

fn path_dirs(env: &dyn Fn(&str) -> Option<String>) -> Vec<PathBuf> {
    env("PATH")
        .or_else(|| env("Path"))
        .map(|p| std::env::split_paths(&p).collect())
        .unwrap_or_default()
}

/// npm global prefixes that are often not on PATH: npm's default one only (no machine-specific
/// folders: a Codex anywhere else is named with REALMNEST_CODEX_PATH)
fn known_prefixes(env: &dyn Fn(&str) -> Option<String>) -> Vec<PathBuf> {
    if !cfg!(windows) {
        return vec![];
    }
    let home = env("USERPROFILE")
        .map(PathBuf::from)
        .unwrap_or_else(home_dir);
    vec![env("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join("AppData").join("Roaming"))
        .join("npm")]
}

/// Discovery order: REALMNEST_CODEX_PATH (the executable, or an npm prefix folder), PATH
/// (a native `codex`, or an npm install resolved to its native binary), %APPDATA%\npm.
/// Never the .cmd shim: nothing runs through a shell.
pub fn locate(env: &dyn Fn(&str) -> Option<String>) -> Option<Resolved> {
    if let Some(p) = env("REALMNEST_CODEX_PATH").map(PathBuf::from) {
        let shim = p
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| e.eq_ignore_ascii_case("cmd"));
        if is_file(&p) && !shim {
            return Some(direct(p, "env"));
        }
        let prefix = if shim { p.parent() } else { Some(p.as_path()) };
        if let Some(exe) = prefix.and_then(from_prefix) {
            return Some(direct(exe, "env"));
        }
    }
    for dir in path_dirs(env) {
        let exe = dir.join(EXE);
        if cfg!(windows) {
            if is_file(&dir.join("codex.cmd")) {
                if let Some(native) = from_prefix(&dir) {
                    return Some(direct(native, "path"));
                }
            }
            if is_file(&exe) {
                return Some(direct(exe, "path"));
            }
        } else if is_file(&exe) {
            // an npm install links bin/codex to the package's codex.js
            let real = fs::canonicalize(&exe).unwrap_or_else(|_| exe.clone());
            if real.extension().and_then(|e| e.to_str()) == Some("js") {
                if let Some(native) = real
                    .parent()
                    .and_then(Path::parent)
                    .and_then(native_in_package)
                {
                    return Some(direct(native, "path"));
                }
                continue;
            }
            return Some(direct(exe, "path"));
        }
    }
    known_prefixes(env)
        .iter()
        .find_map(|p| from_prefix(p))
        .map(|p| direct(p, "npm"))
}

// ── the account's models ───────────────────────────────────

/// Codex keeps the models the signed-in account can use in `<CODEX_HOME>/models_cache.json`.
/// Only that file is read, only up to this size, and only the fields below leave Rust.
pub const MODELS_CACHE: &str = "models_cache.json";
const MAX_CACHE_BYTES: u64 = 8 * 1024 * 1024;
const MAX_MODELS: usize = 64;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexModel {
    pub slug: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_reasoning_level: Option<String>,
    pub reasoning_levels: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u64>,
    pub input_modalities: Vec<String>,
}

/// the Codex folder of a connection: its own one, else CODEX_HOME, else ~/.codex
pub fn codex_home(
    config_dir: Option<&str>,
    env: &dyn Fn(&str) -> Option<String>,
) -> Result<PathBuf, String> {
    if let Some(d) = config_dir.map(str::trim).filter(|d| !d.is_empty()) {
        check_home(d)?;
        return Ok(PathBuf::from(d));
    }
    if let Some(d) = env(HOME_ENV).filter(|d| check_home(d).is_ok()) {
        return Ok(PathBuf::from(d));
    }
    let home = env(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
        .map(PathBuf::from)
        .unwrap_or_else(home_dir);
    Ok(home.join(".codex"))
}

pub fn read_models(home: &Path) -> Result<Vec<CodexModel>, String> {
    let path = home.join(MODELS_CACHE);
    let meta = fs::metadata(&path)
        .map_err(|_| "Codex has not saved its model list yet: run one chat turn first.")?;
    if !meta.is_file() || meta.len() > MAX_CACHE_BYTES {
        return Err("Codex's model list could not be read.".into());
    }
    let text = fs::read_to_string(&path).map_err(|_| "Codex's model list could not be read.")?;
    parse_models(&text)
}

fn short(v: &serde_json::Value, max: usize) -> Option<String> {
    v.as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.chars().take(max).collect())
}

/// a short identifier such as a reasoning effort or a modality
fn word(v: &serde_json::Value) -> Option<String> {
    v.as_str()
        .filter(|s| {
            !s.is_empty()
                && s.len() <= 20
                && s.bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        })
        .map(String::from)
}

/// `["text", "image"]` or `[{"effort": "low"}, …]`
fn words(v: &serde_json::Value) -> Vec<String> {
    v.as_array()
        .map(|a| {
            a.iter()
                .filter_map(|x| word(x).or_else(|| word(&x["effort"])))
                .take(12)
                .collect()
        })
        .unwrap_or_default()
}

/// The chat models in the cache: listed ones only (hidden helpers such as the review model
/// are skipped), in Codex's own order.
pub fn parse_models(text: &str) -> Result<Vec<CodexModel>, String> {
    let cache: serde_json::Value =
        serde_json::from_str(text).map_err(|_| "Codex's model list could not be read.")?;
    let all = cache["models"]
        .as_array()
        .ok_or("Codex's model list could not be read.")?;
    let mut models: Vec<CodexModel> = all
        .iter()
        .filter(|m| m["visibility"].as_str().is_none_or(|v| v == "list"))
        .filter_map(|m| {
            let slug = m["slug"].as_str().filter(|s| is_model(s))?;
            Some(CodexModel {
                slug: slug.to_string(),
                display_name: short(&m["display_name"], 80),
                description: short(&m["description"], 300),
                default_reasoning_level: word(&m["default_reasoning_level"]),
                reasoning_levels: words(&m["supported_reasoning_levels"]),
                priority: m["priority"].as_i64(),
                context_window: m["context_window"].as_u64(),
                input_modalities: words(&m["input_modalities"]),
            })
        })
        .take(MAX_MODELS)
        .collect();
    models.sort_by_key(|m| m.priority.unwrap_or(i64::MAX));
    Ok(models)
}

/// the models of a connection's Codex folder (the `codex_models` command)
pub fn models_for(config_dir: Option<&str>) -> Result<Vec<CodexModel>, String> {
    read_models(&codex_home(config_dir, &|k| std::env::var(k).ok())?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use std::collections::{BTreeMap, HashMap};

    const CASES: &str = include_str!("../../../src/runtime/providers/codex/args.cases.json");

    fn vecs(v: &Value) -> Vec<Vec<String>> {
        v.as_array()
            .unwrap()
            .iter()
            .map(|a| {
                a.as_array()
                    .unwrap()
                    .iter()
                    .map(|s| s.as_str().unwrap().to_string())
                    .collect()
            })
            .collect()
    }

    #[test]
    fn allowlist_matches_the_typescript_cases() {
        let cases: Value = serde_json::from_str(CASES).unwrap();
        for args in vecs(&cases["allow"]) {
            assert_eq!(check_args(&args), Ok(()), "should allow {args:?}");
        }
        for args in vecs(&cases["deny"]) {
            assert!(check_args(&args).is_err(), "should deny {args:?}");
        }
    }

    #[test]
    fn the_bridge_config_becomes_codex_mcp_settings_naming_realmnest_only() {
        let cfg = r"C:\Users\me\AppData\Local\app.nestra.desktop\realmnest-bridge\run-1.json";
        let exe = std::path::Path::new(r"C:\Apps\realmnest-os.exe");
        let file = |command: &str, addr: &str| {
            let body = serde_json::json!({ "mcpServers": { "realmnest": { "type": "stdio", "command": command, "args": ["--mcp-bridge"], "env": { "REALMNEST_BRIDGE_ADDR": addr, "REALMNEST_BRIDGE_TOKEN": "tok_123" } } } });
            let bytes = serde_json::to_vec(&body).unwrap();
            move |_: &std::path::Path| Ok::<Vec<u8>, String>(bytes.clone())
        };
        let args: Vec<String> = ["exec", "--json", "--realmnest-bridge", cfg, "-"]
            .iter()
            .map(|s| s.to_string())
            .collect();
        let out = expand_bridge(
            &args,
            &file(r"C:\Apps\realmnest-os.exe", "127.0.0.1:5000"),
            Some(exe),
        )
        .unwrap();
        assert!(!out.iter().any(|a| a == BRIDGE_FLAG));
        assert_eq!(out.first().map(String::as_str), Some("exec"));
        assert_eq!(out.last().map(String::as_str), Some("-"));
        assert!(out.contains(
            &r#"mcp_servers.realmnest.command="C:\\Apps\\realmnest-os.exe""#.to_string()
        ));
        assert!(out.contains(&"mcp_servers.realmnest.env={ REALMNEST_BRIDGE_ADDR = \"127.0.0.1:5000\", REALMNEST_BRIDGE_TOKEN = \"tok_123\" }".to_string()));
        assert!(out.contains(
            &"mcp_servers.realmnest.default_tools_approval_mode=\"approve\"".to_string()
        ));
        // another program, or a non-loopback address: refused
        assert!(expand_bridge(
            &args,
            &file(r"C:\Windows\cmd.exe", "127.0.0.1:5000"),
            Some(exe)
        )
        .is_err());
        assert!(expand_bridge(
            &args,
            &file(r"C:\Apps\realmnest-os.exe", "10.0.0.5:5000"),
            Some(exe)
        )
        .is_err());
        // a turn without the bridge is passed as it is
        let plain: Vec<String> = vec!["exec".into(), "-".into()];
        assert_eq!(
            expand_bridge(&plain, &file("x", "y"), Some(exe)).unwrap(),
            plain
        );
    }

    #[test]
    fn toml_strings_are_escaped_or_refused() {
        assert!(is_toml_string(r#""You are \"Hana\".\nBe brief. \u0001 è""#));
        assert!(!is_toml_string(r#""""#));
        assert!(!is_toml_string(r#""a"b""#));
        assert!(!is_toml_string(r#""ends with \""#));
        assert!(!is_toml_string("\"raw\nnewline\""));
        assert!(!is_toml_string(r#""bad \x escape""#));
        assert!(!is_toml_string(r#""\uD800 surrogate""#));
        assert!(!is_toml_string(r#""\u12 short""#));
        assert!(!is_toml_string(&format!(
            "\"{}\"",
            "a".repeat(MAX_INSTRUCTIONS)
        )));
    }

    #[test]
    fn only_an_existing_absolute_codex_folder_may_be_set() {
        let dir = std::env::temp_dir();
        let ok: BTreeMap<String, String> =
            [(HOME_ENV.to_string(), dir.display().to_string())].into();
        assert_eq!(check_env(&ok), Ok(()));
        assert_eq!(check_env(&BTreeMap::new()), Ok(()));
        let other: BTreeMap<String, String> =
            [("OPENAI_API_KEY".to_string(), "x".to_string())].into();
        assert!(check_env(&other).is_err());
        let relative: BTreeMap<String, String> =
            [(HOME_ENV.to_string(), "relative/dir".to_string())].into();
        assert!(check_env(&relative).is_err());
        let missing: BTreeMap<String, String> = [(
            HOME_ENV.to_string(),
            dir.join("realmnest-no-such-dir").display().to_string(),
        )]
        .into();
        assert!(check_env(&missing).is_err());
    }

    #[test]
    fn keys_and_codex_session_variables_are_dropped() {
        let base: Vec<(String, String)> = [
            "PATH",
            "CODEX_HOME",
            "OPENAI_API_KEY",
            "CODEX_API_KEY",
            "CODEX_SANDBOX",
            "CODEX_THREAD_ID",
            "CODEX_MANAGED_BY_NPM",
            "HTTPS_PROXY",
            "RUST_LOG",
        ]
        .iter()
        .map(|k| (k.to_string(), "v".to_string()))
        .collect();
        let env = Codex.env(base);
        let mut kept: Vec<String> = env.iter().map(|(k, _)| k.clone()).collect();
        kept.sort();
        assert_eq!(kept, ["CODEX_HOME", "HTTPS_PROXY", "PATH", "RUST_LOG"]);
        // the user's own log filter is replaced: only the retry warning reaches stderr
        let log: Vec<&str> = env
            .iter()
            .filter(|(k, _)| k == "RUST_LOG")
            .map(|(_, v)| v.as_str())
            .collect();
        assert_eq!(log, [RETRY_LOG]);
    }

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("realmnest-codex-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    fn touch(p: &Path, text: &str) {
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, text).unwrap();
    }

    /// an npm prefix: the shim, the package and its native binary
    fn npm_prefix(prefix: &Path) -> PathBuf {
        let (platform, triple) = target().unwrap();
        touch(&prefix.join("codex.cmd"), "@node codex.js %*");
        let pkg = prefix.join("node_modules").join("@openai").join("codex");
        touch(
            &pkg.join("package.json"),
            r#"{"name":"@openai/codex","bin":{"codex":"bin/codex.js"}}"#,
        );
        touch(&pkg.join("bin").join("codex.js"), "");
        let exe = pkg
            .join("node_modules")
            .join("@openai")
            .join(platform)
            .join("vendor")
            .join(triple)
            .join("bin")
            .join(EXE);
        touch(&exe, "");
        exe
    }

    #[test]
    fn finds_the_native_binary_inside_an_npm_install() {
        let prefix = tmp("npm");
        let exe = npm_prefix(&prefix);
        assert_eq!(from_prefix(&prefix), Some(exe));
        // another package with the same layout is not Codex
        let fake = tmp("fake");
        npm_prefix(&fake);
        touch(
            &fake
                .join("node_modules")
                .join("@openai")
                .join("codex")
                .join("package.json"),
            r#"{"name":"something-else"}"#,
        );
        assert_eq!(from_prefix(&fake), None);
    }

    #[cfg(windows)]
    #[test]
    fn discovery_order_env_then_path_then_npm_prefix() {
        let base = tmp("order");
        let explicit = base.join("explicit").join(EXE);
        touch(&explicit, "");
        let on_path = npm_prefix(&base.join("bin"));
        let appdata = base.join("Roaming");
        let in_appdata = npm_prefix(&appdata.join("npm"));

        let mut vars: HashMap<&str, String> = HashMap::new();
        vars.insert("USERPROFILE", base.join("home").display().to_string());
        vars.insert("APPDATA", appdata.display().to_string());
        vars.insert("PATH", base.join("bin").display().to_string());
        vars.insert("REALMNEST_CODEX_PATH", explicit.display().to_string());
        let get = |v: &HashMap<&str, String>, k: &str| v.get(k).cloned();

        let r = locate(&|k| get(&vars, k)).unwrap();
        assert_eq!((r.source, r.command.clone()), ("env", explicit.clone()));
        // the shim itself is never run
        vars.insert(
            "REALMNEST_CODEX_PATH",
            base.join("bin").join("codex.cmd").display().to_string(),
        );
        let r = locate(&|k| get(&vars, k)).unwrap();
        assert_eq!((r.source, r.command.clone()), ("env", on_path.clone()));
        vars.remove("REALMNEST_CODEX_PATH");
        let r = locate(&|k| get(&vars, k)).unwrap();
        assert_eq!((r.source, r.command.clone()), ("path", on_path.clone()));
        vars.insert("PATH", base.join("nowhere").display().to_string());
        let r = locate(&|k| get(&vars, k)).unwrap();
        assert_eq!((r.source, r.command.clone()), ("npm", in_appdata));
    }

    #[test]
    fn models_come_from_the_cache_listed_ones_only() {
        let cache = r#"{
          "fetched_at": "2026-10-15T11:11:56Z", "etag": "W/\"x\"", "identity": "secret-hash",
          "models": [
            {"slug":"gpt-6-sol","display_name":"GPT-6-Sol","description":"Previous generation workhorse model.","default_reasoning_level":"medium","supported_reasoning_levels":[{"effort":"low"},{"effort":"medium"},{"effort":"high"}],"visibility":"list","priority":3,"context_window":272000,"input_modalities":["text","image"],"model_messages":{"x":"y"}},
            {"slug":"gpt-6.1-sol","display_name":"GPT-6.1-Sol","visibility":"list","priority":1,"supported_reasoning_levels":[{"effort":"low"}]},
            {"slug":"codex-auto-review","display_name":"Codex Auto Review","visibility":"hide","priority":43},
            {"slug":"bad slug; rm","visibility":"list","priority":2}
          ]
        }"#;
        let models = parse_models(cache).unwrap();
        let slugs: Vec<&str> = models.iter().map(|m| m.slug.as_str()).collect();
        assert_eq!(slugs, ["gpt-6.1-sol", "gpt-6-sol"]);
        let sol = &models[1];
        assert_eq!(sol.display_name.as_deref(), Some("GPT-6-Sol"));
        assert_eq!(sol.reasoning_levels, ["low", "medium", "high"]);
        assert_eq!(sol.default_reasoning_level.as_deref(), Some("medium"));
        assert_eq!(sol.context_window, Some(272000));
        assert_eq!(sol.input_modalities, ["text", "image"]);
        let json = serde_json::to_string(&models).unwrap();
        assert!(!json.contains("secret-hash") && !json.contains("model_messages"));
        assert!(parse_models("not json").is_err());
    }

    #[test]
    fn the_cache_is_read_from_the_connection_folder() {
        let home = tmp("home");
        assert!(read_models(&home).is_err(), "no cache yet");
        touch(
            &home.join(MODELS_CACHE),
            r#"{"models":[{"slug":"gpt-6-luna","visibility":"list"}]}"#,
        );
        assert_eq!(read_models(&home).unwrap()[0].slug, "gpt-6-luna");
        assert_eq!(
            codex_home(Some(&home.display().to_string()), &|_| None).unwrap(),
            home
        );
        assert!(codex_home(Some("relative"), &|_| None).is_err());
        let profile = tmp("profile");
        let vars =
            |k: &str| (k == "USERPROFILE" || k == "HOME").then(|| profile.display().to_string());
        assert_eq!(codex_home(None, &vars).unwrap(), profile.join(".codex"));
    }
}
