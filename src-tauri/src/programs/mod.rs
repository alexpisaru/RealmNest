//! Programs the desktop host is willing to run. The frontend names a program
//! id; everything else (where the executable is, which arguments are allowed,
//! its environment, its working directory) is decided here, in Rust, whatever
//! the frontend already checked.

pub mod claude;
pub mod claude_login;
pub mod codex;
pub mod codex_login;

use std::path::PathBuf;

/// A located executable.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Resolved {
    /// executable to spawn
    pub command: PathBuf,
    /// arguments placed before the caller's (e.g. a script for node)
    pub prefix_args: Vec<String>,
    /// what to show the user
    pub path: String,
    pub source: &'static str,
}

pub trait HostProgram: Send + Sync {
    fn id(&self) -> &str;
    /// None when it is not installed
    fn locate(&self) -> Option<Resolved>;
    /// Ok when every argument is allowed, otherwise the reason
    fn check_args(&self, args: &[String]) -> Result<(), String>;
    /// the child's environment, derived from the host's
    fn env(&self, base: Vec<(String, String)>) -> Vec<(String, String)> {
        base
    }
    /// Ok when the request's extra variables are allowed; by default none are
    fn check_env(&self, env: &std::collections::BTreeMap<String, String>) -> Result<(), String> {
        if env.is_empty() {
            Ok(())
        } else {
            Err("no environment variables are allowed for this program".into())
        }
    }
    /// working directory when the request has none (created if missing)
    fn default_cwd(&self) -> PathBuf {
        home_dir()
    }
    /// whether a request may name its own working directory (otherwise only `default_cwd`)
    fn accepts_cwd(&self) -> bool {
        true
    }
    /// the arguments actually passed, after `check_args`: a program may expand a checked shorthand
    /// (Codex: `--realmnest-bridge <config>` → its MCP settings, read here, never from the page)
    fn expand_args(&self, args: &[String]) -> Result<Vec<String>, String> {
        Ok(args.to_vec())
    }
}

pub fn home_dir() -> PathBuf {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
}
