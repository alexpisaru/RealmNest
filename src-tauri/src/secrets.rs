//! Connection secrets (API keys, refresh tokens) in the operating system's
//! credential store: Windows Credential Manager, macOS Keychain.
//!
//! The webview can store, replace, delete and check a secret, but can never
//! read one back: values only leave this module towards Rust code that calls
//! a provider (future API-key adapters). Nothing here logs values.

use keyring::Entry;

/// the credential store "service" every RealmNest secret lives under
const SERVICE: &str = "app.nestra.desktop";

/// `conn.<id>.<field>`-like names only: no paths, no spaces
pub fn check_ref(r: &str) -> Result<(), String> {
    let ok = !r.is_empty()
        && r.len() <= 128
        && r.chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'));
    if ok {
        Ok(())
    } else {
        Err("invalid secret name".into())
    }
}

fn is_id(v: &str) -> bool {
    !v.is_empty()
        && v.len() <= 64
        && v.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// The names the page may set, delete or check: `conn.<id>.<field>`, `mcp.<server id>.<VAR>`
/// and `telegram.botToken`. Rust-only records are never page names: OAuth sign-ins
/// (`mcp.<id>.OAUTH…`) and the address a header secret belongs to (`<name>.origin`).
pub fn check_page_name(r: &str) -> Result<(), String> {
    check_ref(r)?;
    let parts: Vec<&str> = r.split('.').collect();
    let ok = match parts.as_slice() {
        ["telegram", "botToken"] => true,
        ["conn", id, field] => {
            is_id(id)
                && field.len() <= 64
                && field.starts_with(|c: char| c.is_ascii_alphabetic())
                && field
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'_')
        }
        ["mcp", id, var] => {
            crate::mcp::is_server_id(id)
                && crate::mcp::is_env_name(var)
                && !var.to_ascii_uppercase().starts_with("OAUTH")
        }
        _ => false,
    };
    if ok {
        Ok(())
    } else {
        Err("this secret name is not allowed".into())
    }
}

/// Where Rust records the server address an MCP header secret was first sent to.
pub fn origin_ref(r: &str) -> String {
    format!("{r}.origin")
}

/// From the page: store a secret. A new MCP value starts unbound: the next connection binds it
/// to its address again.
pub fn page_set(r: &str, value: &str) -> Result<(), String> {
    check_page_name(r)?;
    set(r, value)?;
    if r.starts_with("mcp.") {
        let _ = delete(&origin_ref(r));
    }
    Ok(())
}

pub fn page_delete(r: &str) -> Result<(), String> {
    check_page_name(r)?;
    delete(r)?;
    if r.starts_with("mcp.") {
        let _ = delete(&origin_ref(r));
    }
    Ok(())
}

pub fn page_exists(r: &str) -> Result<bool, String> {
    check_page_name(r)?;
    exists(r)
}

fn entry(r: &str) -> Result<Entry, String> {
    check_ref(r)?;
    Entry::new(SERVICE, r).map_err(|e| format!("credential store unavailable: {e}"))
}

pub fn set(r: &str, value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > 16_384 {
        return Err("invalid secret value".into());
    }
    entry(r)?
        .set_password(value)
        .map_err(|e| format!("could not save the secret: {e}"))
}

pub fn delete(r: &str) -> Result<(), String> {
    match entry(r)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("could not delete the secret: {e}")),
    }
}

pub fn exists(r: &str) -> Result<bool, String> {
    match entry(r)?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(format!("credential store unavailable: {e}")),
    }
}

/// For Rust-side provider code only; never exposed as a command.
#[allow(dead_code)]
pub fn read(r: &str) -> Result<Option<String>, String> {
    match entry(r)?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("credential store unavailable: {e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_restricted() {
        assert!(check_ref("conn.abc-1.apiKey").is_ok());
        assert!(check_ref("").is_err());
        assert!(check_ref("../x").is_err());
        assert!(check_ref("a b").is_err());
        assert!(check_ref(&"x".repeat(129)).is_err());
    }

    #[test]
    fn the_page_may_only_name_its_own_kinds_of_secret() {
        for ok in [
            "conn.conn-lx2a-1.apiKey",
            "conn.openrouter_1.apiKey",
            "mcp.github.GITHUB_TOKEN",
            "mcp.srv-1.HDR_AUTHORIZATION",
            "mcp.srv-1.HDR_X_OAUTH_TOKEN",
            "telegram.botToken",
        ] {
            assert!(check_page_name(ok).is_ok(), "{ok}");
        }
        for bad in [
            // Rust-only records: OAuth sign-ins, header origins
            "mcp.srv-1.OAUTH",
            "mcp.srv-1.oauth",
            "mcp.srv-1.OAUTH.0",
            "mcp.srv-1.OAUTH_EXTRA",
            "mcp.srv-1.HDR_AUTHORIZATION.origin",
            // anything else
            "conn.a.b.c",
            "conn..apiKey",
            "conn.a.1key",
            "mcp.a b.X",
            "mcp.srv.1BAD",
            "telegram.other",
            "test.realmnest.1",
            "app.anything",
            "",
        ] {
            assert!(check_page_name(bad).is_err(), "{bad}");
        }
        assert_eq!(origin_ref("mcp.s.HDR_A"), "mcp.s.HDR_A.origin".to_string());
    }

    /// real round trip through the OS credential store
    #[test]
    #[cfg(windows)]
    fn stores_checks_and_deletes_in_the_os_credential_store() {
        let r = format!("test.realmnest.{}", std::process::id());
        delete(&r).unwrap();
        assert_eq!(exists(&r), Ok(false));
        set(&r, "s3cret-value").unwrap();
        assert_eq!(exists(&r), Ok(true));
        assert_eq!(read(&r), Ok(Some("s3cret-value".to_string())));
        set(&r, "replaced").unwrap();
        assert_eq!(read(&r), Ok(Some("replaced".to_string())));
        delete(&r).unwrap();
        assert_eq!(exists(&r), Ok(false));
        assert!(set(&r, "").is_err());
    }
}
