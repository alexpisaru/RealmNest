//! Claude Code, as the desktop host runs it. Mirrors
//! `src/runtime/providers/claude-code/host.ts` (discovery, environment) and
//! `args.ts` (allowlist); `args.cases.json` keeps the two allowlists identical.

use super::{home_dir, HostProgram, Resolved};
use std::fs;
use std::path::{Path, PathBuf};

pub const ID: &str = "claude";

#[cfg(windows)]
const EXE: &str = "claude.exe";
#[cfg(not(windows))]
const EXE: &str = "claude";

pub struct Claude;

impl HostProgram for Claude {
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
        base.into_iter()
            .filter(|(k, _)| !is_session_var(k))
            .collect()
    }
    fn default_cwd(&self) -> PathBuf {
        // a neutral folder: no project CLAUDE.md, settings or MCP servers by accident (turns never
        // name another one: RealmNest tools get the agent's workspace through the bridge)
        home_dir().join(".nestra").join("workspace")
    }
    fn accepts_cwd(&self) -> bool {
        // a project folder would bring its CLAUDE.md, settings and hooks with it
        false
    }
}

// ── allowlist ──────────────────────────────────────────────

fn is_uuid(v: &str) -> bool {
    let b = v.as_bytes();
    b.len() == 36
        && b.iter().enumerate().all(|(i, c)| match i {
            8 | 13 | 18 | 23 => *c == b'-',
            _ => c.is_ascii_hexdigit(),
        })
}

fn is_model(v: &str) -> bool {
    let mut chars = v.chars();
    matches!(chars.next(), Some(c) if c.is_ascii_alphanumeric())
        && v.chars().count() <= 80
        && chars.all(|c| c.is_ascii_alphanumeric() || "._:-[]".contains(c))
}

/// Claude's own tools: none, or WebSearch alone (a search turn, or Web on) — never Bash, Read, Edit…
fn is_tool_list(v: &str) -> bool {
    v.is_empty() || v == WEB_SEARCH_TOOL
}

/// RealmNest's own MCP bridge configs: `<absolute dir>/realmnest-bridge/<session>.json`.
/// In the app the folder must also be the one the bridge writes to (set at startup).
pub static BRIDGE_DIR: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();

pub(crate) fn is_bridge_config(v: &str) -> bool {
    let p = Path::new(v);
    let name_ok = p
        .file_name()
        .and_then(|n| n.to_str())
        .and_then(|n| n.strip_suffix(".json"))
        .is_some_and(|id| {
            !id.is_empty()
                && id.len() <= 64
                && id
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        });
    let parent = p.parent();
    let dir_ok = parent
        .and_then(|d| d.file_name())
        .is_some_and(|d| d == "realmnest-bridge");
    let place_ok = match BRIDGE_DIR.get() {
        Some(dir) => parent == Some(dir.as_path()),
        None => true,
    };
    v.len() <= 1024 && p.is_absolute() && !v.contains("..") && name_ok && dir_ok && place_ok
}

/// one RealmNest bridge tool: `mcp__realmnest__<name>`
fn is_bridge_tool(t: &str) -> bool {
    t.strip_prefix("mcp__realmnest__").is_some_and(|n| {
        !n.is_empty()
            && n.len() <= 64
            && n.bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    })
}

/// `--allowedTools`: RealmNest's bridge tools (at most 32) and WebSearch (at most once), comma-separated
fn is_allowed_tool_list(v: &str) -> bool {
    let tools: Vec<&str> = v.split(',').collect();
    let bridge = tools.iter().filter(|t| is_bridge_tool(t)).count();
    let web = tools.iter().filter(|t| **t == WEB_SEARCH_TOOL).count();
    !v.is_empty() && bridge <= 32 && web <= 1 && bridge + web == tools.len()
}

fn is_prompt_text(v: &str) -> bool {
    // same unit as JavaScript's string length (UTF-16 code units)
    let len = v.encode_utf16().count();
    len > 0 && len <= 20_000 && !v.contains('\0')
}

enum Flag {
    Switch,
    Value(fn(&str) -> bool),
}

fn flag(name: &str) -> Option<Flag> {
    Some(match name {
        "-p"
        | "--verbose"
        | "--include-partial-messages"
        | "--no-session-persistence"
        | "--strict-mcp-config" => Flag::Switch,
        "--output-format" | "--input-format" => Flag::Value(|v| v == "stream-json"),
        "--permission-prompts" => Flag::Value(|v| v == "none"),
        // the user's own settings only: never a project's .claude/settings*.json (hooks, env)
        "--setting-sources" => Flag::Value(|v| v == SETTING_SOURCES),
        "--session-id" | "--resume" => Flag::Value(is_uuid),
        "--model" => Flag::Value(is_model),
        "--effort" => Flag::Value(|v| EFFORTS.contains(&v)),
        "--append-system-prompt" | "--system-prompt" => Flag::Value(is_prompt_text),
        "--tools" => Flag::Value(is_tool_list),
        "--mcp-config" => Flag::Value(is_bridge_config),
        "--allowedTools" => Flag::Value(is_allowed_tool_list),
        _ => return None,
    })
}

/// `--effort` levels every Claude model takes (CLAUDE_EFFORTS in models.ts)
pub const EFFORTS: [&str; 5] = ["low", "medium", "high", "xhigh", "max"];

/// Claude Code's own web search tool, the only built-in a search turn may allow without a prompt.
pub const WEB_SEARCH_TOOL: &str = "WebSearch";

/// `--setting-sources`: required on every turn (see check_args)
pub const SETTING_SOURCES: &str = "user";

/// Same rules as `checkClaudeArgs` in args.ts.
pub fn check_args(args: &[String]) -> Result<(), String> {
    let exact: [&[&str]; 2] = [&["--version"], &["auth", "status", "--json"]];
    if exact
        .iter()
        .any(|e| e.len() == args.len() && e.iter().zip(args).all(|(a, b)| a == b))
    {
        return Ok(());
    }
    if args.first().map(String::as_str) != Some("-p") {
        return Err("only print mode (-p) is allowed".into());
    }
    let mut seen: Vec<&str> = Vec::new();
    let mut i = 0;
    while i < args.len() {
        let name = args[i].as_str();
        let Some(f) = flag(name) else {
            return Err(format!(
                "argument not allowed: {}",
                name.chars().take(40).collect::<String>()
            ));
        };
        if seen.contains(&name) {
            return Err(format!("duplicate flag: {name}"));
        }
        seen.push(name);
        if let Flag::Value(ok) = f {
            i += 1;
            match args.get(i) {
                Some(v) if ok(v) => {}
                _ => return Err(format!("invalid value for {name}")),
            }
        }
        i += 1;
    }
    if seen.contains(&"--session-id") && seen.contains(&"--resume") {
        return Err("--session-id and --resume are exclusive".into());
    }
    if seen.contains(&"--system-prompt") && seen.contains(&"--append-system-prompt") {
        return Err("--system-prompt and --append-system-prompt are exclusive".into());
    }
    // the bridge only with RealmNest's own config, and never Claude's own MCP sources
    if seen.contains(&"--mcp-config") && !seen.contains(&"--strict-mcp-config") {
        return Err("--mcp-config needs --strict-mcp-config".into());
    }
    // --allowedTools: the RealmNest bridge's tools (with --mcp-config) and/or WebSearch, which needs --tools WebSearch
    if seen.contains(&"--allowedTools") {
        let value_of = |flag: &str| {
            args.iter()
                .position(|a| a == flag)
                .and_then(|i| args.get(i + 1))
                .map(String::as_str)
        };
        let allowed = value_of("--allowedTools").unwrap_or_default();
        if !seen.contains(&"--mcp-config") && allowed != WEB_SEARCH_TOOL {
            return Err(
                "--allowedTools is only for the RealmNest bridge or a WebSearch turn".into(),
            );
        }
        if allowed.split(',').any(|t| t == WEB_SEARCH_TOOL)
            && value_of("--tools") != Some(WEB_SEARCH_TOOL)
        {
            return Err("WebSearch in --allowedTools needs --tools WebSearch".into());
        }
    }
    if !seen.contains(&"--output-format") {
        return Err("--output-format stream-json is required".into());
    }
    if !seen.contains(&"--setting-sources") {
        return Err("--setting-sources user is required".into());
    }
    Ok(())
}

// ── environment ────────────────────────────────────────────

/// The only variable a connection may set: its own Claude config folder
/// (a separate sign-in). Same rule as `checkClaudeEnv` in args.ts, plus the
/// folder must exist.
pub const CONFIG_ENV: &str = "CLAUDE_CONFIG_DIR";

pub fn check_env(env: &std::collections::BTreeMap<String, String>) -> Result<(), String> {
    for (k, v) in env {
        if k != CONFIG_ENV {
            return Err(format!(
                "environment variable not allowed: {}",
                k.chars().take(40).collect::<String>()
            ));
        }
        let p = Path::new(v);
        if v.is_empty() || v.len() > 1024 || v.contains('\0') || !p.is_absolute() {
            return Err(format!("{CONFIG_ENV} must be an absolute folder path"));
        }
        if !p.is_dir() {
            return Err("the Claude config folder does not exist".into());
        }
    }
    Ok(())
}

/// Variables that tie a process to a running Claude Code session (set when
/// RealmNest is started from inside Claude Code). Same list as host.ts.
pub fn is_session_var(k: &str) -> bool {
    const CODE: [&str; 15] = [
        "ENTRYPOINT",
        "CHILD_SESSION",
        "EAGER_FLUSH",
        "ENABLE_ASK_USER_QUESTION_TOOL",
        "ENABLE_SDK_FILE_CHECKPOINTING",
        "DESKTOP_APP_VERSION",
        "ACCOUNT_UUID",
        "ORGANIZATION_UUID",
        "USER_EMAIL",
        "OAUTH_SCOPES",
        "REPORT_FINDINGS",
        "TERMINAL_MCP_TOOLS",
        "DISABLE_TERMINAL_TITLE",
        "DISABLE_CRON",
        "AUTOUPDATER_DISABLED_BY_HOST",
    ];
    if k == "CLAUDECODE" || k == "CLAUDE_PID" || k.starts_with("CLAUDE_AGENT_SDK_") {
        return true;
    }
    let Some(rest) = k.strip_prefix("CLAUDE_CODE_") else {
        return false;
    };
    rest == "SIMPLE"
        || CODE.contains(&rest)
        || ["SESSION_", "HOST_", "MESSAGING_", "SDK_", "EMIT_"]
            .iter()
            .any(|p| rest.starts_with(p))
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

/// an npm install on Windows is a .cmd shim: run its JS entry with node, never through a shell
fn from_npm_shim(shim: &Path, env: &dyn Fn(&str) -> Option<String>) -> Option<Resolved> {
    let pkg_dir = shim
        .parent()?
        .join("node_modules")
        .join("@anthropic-ai")
        .join("claude-code");
    let pkg: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(pkg_dir.join("package.json")).ok()?).ok()?;
    let rel = pkg["bin"]
        .as_str()
        .or_else(|| pkg["bin"]["claude"].as_str())?;
    let entry = pkg_dir.join(rel);
    if !is_file(&entry) {
        return None;
    }
    let is_js = matches!(
        entry.extension().and_then(|e| e.to_str()),
        Some("js" | "cjs" | "mjs")
    );
    if !is_js {
        return Some(direct(entry, "path"));
    }
    let node = find_in_path(env, if cfg!(windows) { "node.exe" } else { "node" })?;
    Some(Resolved {
        path: entry.display().to_string(),
        command: node,
        prefix_args: vec![entry.display().to_string()],
        source: "path",
    })
}

fn path_dirs(env: &dyn Fn(&str) -> Option<String>) -> Vec<PathBuf> {
    env("PATH")
        .or_else(|| env("Path"))
        .map(|p| std::env::split_paths(&p).collect())
        .unwrap_or_default()
}

fn find_in_path(env: &dyn Fn(&str) -> Option<String>, name: &str) -> Option<PathBuf> {
    path_dirs(env)
        .into_iter()
        .map(|d| d.join(name))
        .find(|p| is_file(p))
}

/// "2.1.293" → comparable key; non-numeric parts sort as 0
fn version_key(v: &str) -> Vec<u64> {
    v.split(['.', '-'])
        .map(|p| p.parse().unwrap_or(0))
        .collect()
}

/// newest `<root>/<version>/<build>/claude(.exe)`: tolerant of Claude updates
pub fn newest_bundled(root: &Path) -> Option<PathBuf> {
    let mut versions: Vec<String> = fs::read_dir(root)
        .ok()?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|n| {
            n.split('.')
                .take(3)
                .filter(|p| !p.is_empty() && p.chars().next().unwrap().is_ascii_digit())
                .count()
                == 3
        })
        .collect();
    versions.sort_by_key(|v| std::cmp::Reverse(version_key(v)));
    versions.iter().find_map(|v| {
        let mut builds: Vec<PathBuf> = fs::read_dir(root.join(v))
            .ok()?
            .filter_map(|e| e.ok())
            .map(|e| e.path().join(EXE))
            .filter(|p| is_file(p))
            .collect();
        builds.sort();
        builds.pop()
    })
}

/// where the Claude desktop app keeps its bundled CLI
fn desktop_roots(env: &dyn Fn(&str) -> Option<String>) -> Vec<PathBuf> {
    let home = env(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
        .map(PathBuf::from)
        .unwrap_or_else(home_dir);
    let mut roots = Vec::new();
    if cfg!(windows) {
        // Store (MSIX) build: its AppData lives in the package folder (only the app's
        // own processes see it under %APPDATA%)
        let packages = env("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join("AppData").join("Local"))
            .join("Packages");
        if let Ok(rd) = fs::read_dir(&packages) {
            let mut pk: Vec<PathBuf> = rd
                .filter_map(|e| e.ok())
                .filter(|e| {
                    e.file_name().to_str().is_some_and(|n| {
                        n.starts_with("Claude_")
                            && n[7..].chars().all(|c| c.is_ascii_alphanumeric())
                    })
                })
                .map(|e| {
                    e.path()
                        .join("LocalCache")
                        .join("Roaming")
                        .join("Claude")
                        .join("claude-code")
                })
                .collect();
            pk.sort();
            roots.extend(pk);
        }
        roots.push(
            env("APPDATA")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join("AppData").join("Roaming"))
                .join("Claude")
                .join("claude-code"),
        );
    } else if cfg!(target_os = "macos") {
        roots.push(
            home.join("Library")
                .join("Application Support")
                .join("Claude")
                .join("claude-code"),
        );
    } else {
        roots.push(
            env("XDG_CONFIG_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join(".config"))
                .join("Claude")
                .join("claude-code"),
        );
    }
    roots
}

/// Discovery order: REALMNEST_CLAUDE_PATH (or the legacy NESTRA_CLAUDE_PATH), PATH, native install, Claude desktop bundle.
pub fn locate(env: &dyn Fn(&str) -> Option<String>) -> Option<Resolved> {
    if let Some(p) = env("REALMNEST_CLAUDE_PATH")
        .or_else(|| env("NESTRA_CLAUDE_PATH"))
        .map(PathBuf::from)
    {
        if is_file(&p) {
            return Some(direct(p, "env"));
        }
    }
    for dir in path_dirs(env) {
        let exe = dir.join(EXE);
        if is_file(&exe) {
            return Some(direct(exe, "path"));
        }
        if cfg!(windows) {
            let shim = dir.join("claude.cmd");
            if is_file(&shim) {
                if let Some(r) = from_npm_shim(&shim, env) {
                    return Some(r);
                }
            }
        }
    }
    let home = env(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
        .map(PathBuf::from)
        .unwrap_or_else(home_dir);
    for p in [
        home.join(".local").join("bin").join(EXE),
        home.join(".claude").join("local").join(EXE),
    ] {
        if is_file(&p) {
            return Some(direct(p, "native"));
        }
    }
    desktop_roots(env)
        .iter()
        .find_map(|r| newest_bundled(r))
        .map(|p| direct(p, "desktop-app"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use std::collections::HashMap;

    const CASES: &str = include_str!("../../../src/runtime/providers/claude-code/args.cases.json");

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
    fn only_an_existing_absolute_config_folder_may_be_set() {
        use std::collections::BTreeMap;
        let dir = std::env::temp_dir();
        let ok: BTreeMap<String, String> =
            [(CONFIG_ENV.to_string(), dir.display().to_string())].into();
        assert_eq!(check_env(&ok), Ok(()));
        assert_eq!(check_env(&BTreeMap::new()), Ok(()));
        let other: BTreeMap<String, String> =
            [("ANTHROPIC_API_KEY".to_string(), "x".to_string())].into();
        assert!(check_env(&other).is_err());
        let relative: BTreeMap<String, String> =
            [(CONFIG_ENV.to_string(), "relative/dir".to_string())].into();
        assert!(check_env(&relative).is_err());
        let missing: BTreeMap<String, String> = [(
            CONFIG_ENV.to_string(),
            dir.join("realmnest-no-such-dir").display().to_string(),
        )]
        .into();
        assert!(check_env(&missing).is_err());
    }

    #[test]
    fn session_variables_are_dropped_user_config_kept() {
        let base: Vec<(String, String)> = [
            "PATH",
            "CLAUDECODE",
            "CLAUDE_CODE_SESSION_ID",
            "CLAUDE_CODE_MESSAGING_TOKEN",
            "CLAUDE_AGENT_SDK_VERSION",
            "CLAUDE_CODE_USE_BEDROCK",
            "CLAUDE_CODE_OAUTH_TOKEN",
            "ANTHROPIC_API_KEY",
        ]
        .iter()
        .map(|k| (k.to_string(), "v".to_string()))
        .collect();
        let mut kept: Vec<String> = Claude.env(base).into_iter().map(|(k, _)| k).collect();
        kept.sort();
        assert_eq!(
            kept,
            [
                "ANTHROPIC_API_KEY",
                "CLAUDE_CODE_OAUTH_TOKEN",
                "CLAUDE_CODE_USE_BEDROCK",
                "PATH"
            ]
        );
    }

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("realmnest-rs-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    fn touch(p: &Path) {
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, b"").unwrap();
    }

    #[test]
    fn picks_the_newest_bundled_version_whatever_its_number() {
        let root = tmp("bundle");
        for v in ["2.1.289", "2.1.293", "2.1.1000", "notes"] {
            touch(&root.join(v).join("abc123").join(EXE));
        }
        fs::create_dir_all(root.join("2.2.0").join("empty")).unwrap(); // newer but without an executable
        let found = newest_bundled(&root).unwrap();
        assert!(found.starts_with(root.join("2.1.1000")), "{found:?}");
    }

    #[test]
    fn discovery_order_env_then_path_then_bundle() {
        let base = tmp("order");
        let explicit = base.join("explicit").join(EXE);
        let on_path = base.join("bin").join(EXE);
        let home = base.join("home");
        touch(&explicit);
        touch(&on_path);
        fs::create_dir_all(&home).unwrap();
        let bundle_root = if cfg!(windows) {
            home.join("AppData").join("Roaming")
        } else {
            home.join(".config")
        };
        touch(
            &bundle_root
                .join("Claude")
                .join("claude-code")
                .join("9.9.9")
                .join("b")
                .join(EXE),
        );

        let mut vars: HashMap<&str, String> = HashMap::new();
        vars.insert(
            if cfg!(windows) { "USERPROFILE" } else { "HOME" },
            home.display().to_string(),
        );
        vars.insert(
            "LOCALAPPDATA",
            home.join("AppData").join("Local").display().to_string(),
        );
        vars.insert(
            "APPDATA",
            home.join("AppData").join("Roaming").display().to_string(),
        );
        vars.insert(
            "XDG_CONFIG_HOME",
            home.join(".config").display().to_string(),
        );
        vars.insert("PATH", base.join("bin").display().to_string());
        vars.insert("REALMNEST_CLAUDE_PATH", explicit.display().to_string());
        let get = |v: &HashMap<&str, String>, k: &str| v.get(k).cloned();

        let r = locate(&|k| get(&vars, k)).unwrap();
        assert_eq!((r.source, r.command.clone()), ("env", explicit.clone()));
        vars.remove("REALMNEST_CLAUDE_PATH");
        let r = locate(&|k| get(&vars, k)).unwrap();
        assert_eq!((r.source, r.command.clone()), ("path", on_path.clone()));
        vars.insert("PATH", base.join("nowhere").display().to_string());
        let r = locate(&|k| get(&vars, k)).unwrap();
        assert_eq!(r.source, "desktop-app");
        fs::remove_dir_all(bundle_root.join("Claude")).unwrap();
        assert!(
            locate(&|k| get(&vars, k)).is_none(),
            "nothing left: not installed"
        );
    }
}
