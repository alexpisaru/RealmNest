//! Which addresses RealmNest's web layer may reach: public internet only.
//!
//! - schemes: http and https only (no file, ftp, data, javascript, custom or internal schemes)
//! - no credentials in the URL, ports 80 / 443 / 8080 / 8443 (or the scheme default)
//! - host names: no localhost, *.localhost, *.local, *.internal, *.lan, *.home.arpa, single-label
//!   intranet names or cloud metadata names
//! - IP addresses (literal or resolved): no loopback, private, link-local, CGNAT, unspecified,
//!   multicast, reserved, documentation or benchmarking ranges, no IPv6 unique-local / link-local,
//!   IPv4-mapped / NAT64 addresses are judged by the IPv4 inside them
//! - DNS: `GuardResolver` resolves and refuses the whole name if ANY address is not public; the
//!   connection uses exactly those checked addresses, so a second lookup cannot rebind it
//!
//! `Policy` exists so tests can allow one loopback test server; the app always uses `Policy::PUBLIC`.

use reqwest::dns::{Addrs, Name, Resolve, Resolving};
use reqwest::Url;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Policy {
    /// a loopback test server (tests only): its port is allowed on 127.0.0.1
    pub test_loopback_port: Option<u16>,
}

impl Policy {
    pub const PUBLIC: Policy = Policy {
        test_loopback_port: None,
    };

    pub fn ip_allowed(&self, ip: IpAddr, port: u16) -> bool {
        if let Some(p) = self.test_loopback_port {
            if ip == IpAddr::V4(Ipv4Addr::LOCALHOST) && port == p {
                return true;
            }
        }
        is_public(ip)
    }

    fn port_allowed(&self, port: Option<u16>) -> bool {
        match port {
            None | Some(80) | Some(443) | Some(8080) | Some(8443) => true,
            Some(p) => self.test_loopback_port == Some(p),
        }
    }
}

/// Is this address on the public internet?
pub fn is_public(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_public_v4(v4),
        IpAddr::V6(v6) => is_public_v6(v6),
    }
}

fn is_public_v4(ip: Ipv4Addr) -> bool {
    let [a, b, c, _] = ip.octets();
    !(a == 0                                   // "this" network, 0.0.0.0
        || a == 10                             // private
        || a == 127                            // loopback
        || (a == 100 && (64..=127).contains(&b)) // CGNAT 100.64/10
        || (a == 169 && b == 254)              // link-local, cloud metadata 169.254.169.254
        || (a == 172 && (16..=31).contains(&b)) // private
        || (a == 192 && b == 0 && c == 0)      // IETF protocol assignments
        || (a == 192 && b == 0 && c == 2)      // TEST-NET-1
        || (a == 192 && b == 88 && c == 99)    // 6to4 relay anycast
        || (a == 192 && b == 168)              // private
        || (a == 198 && (b == 18 || b == 19))  // benchmarking
        || (a == 198 && b == 51 && c == 100)   // TEST-NET-2
        || (a == 203 && b == 0 && c == 113)    // TEST-NET-3
        || a >= 224) // multicast, reserved, broadcast
}

fn is_public_v6(ip: Ipv6Addr) -> bool {
    if let Some(v4) = ip.to_ipv4_mapped() {
        return is_public_v4(v4);
    }
    let s = ip.segments();
    // NAT64 well-known prefix 64:ff9b::/96: the IPv4 inside decides
    if s[0] == 0x64 && s[1] == 0xff9b && s[2..6] == [0, 0, 0, 0] {
        return is_public_v4(Ipv4Addr::new(
            (s[6] >> 8) as u8,
            s[6] as u8,
            (s[7] >> 8) as u8,
            s[7] as u8,
        ));
    }
    !(ip.is_unspecified()
        || ip.is_loopback()
        || ip.is_multicast()
        || (s[0] & 0xfe00) == 0xfc00 // unique local fc00::/7
        || (s[0] & 0xffc0) == 0xfe80 // link-local fe80::/10
        || (s[0] & 0xffc0) == 0xfec0 // site-local (deprecated) fec0::/10
        || (s[0] == 0x2001 && s[1] == 0x0db8) // documentation
        || (s[0] == 0 && s[1] == 0 && s[2] == 0 && s[3] == 0 && s[4] == 0 && s[5] == 0))
    // IPv4-compatible ::/96
}

/// Host names that always mean "this machine" or "this network".
fn host_name_blocked(host: &str) -> bool {
    let h = host.trim_end_matches('.').to_ascii_lowercase();
    h == "localhost"
        || !h.contains('.')
        || [
            ".localhost",
            ".local",
            ".internal",
            ".lan",
            ".home.arpa",
            ".intranet",
            ".corp",
        ]
        .iter()
        .any(|s| h.ends_with(s))
        || h == "metadata.google.internal"
        || h == "metadata"
}

#[derive(Debug, Clone, PartialEq)]
pub struct Blocked(pub String);

/// The URL itself: scheme, credentials, port, host name / literal IP. DNS is checked later, at connect.
pub fn check_url(url: &Url, policy: &Policy) -> Result<(), Blocked> {
    match url.scheme() {
        "http" | "https" => {}
        s => {
            return Err(Blocked(format!(
                "the {s}: scheme is not allowed (only http and https)"
            )))
        }
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(Blocked(
            "addresses with a user name or password are not allowed".into(),
        ));
    }
    if !policy.port_allowed(url.port()) {
        return Err(Blocked(format!(
            "port {} is not allowed",
            url.port().unwrap_or(0)
        )));
    }
    let port = url.port_or_known_default().unwrap_or(0);
    match url.host() {
        None => Err(Blocked("the address has no host".into())),
        Some(url::Host::Ipv4(ip)) => {
            if policy.ip_allowed(IpAddr::V4(ip), port) {
                Ok(())
            } else {
                Err(Blocked(format!("{ip} is a private or local address")))
            }
        }
        Some(url::Host::Ipv6(ip)) => {
            if policy.ip_allowed(IpAddr::V6(ip), port) {
                Ok(())
            } else {
                Err(Blocked(format!("[{ip}] is a private or local address")))
            }
        }
        Some(url::Host::Domain(d)) => {
            if host_name_blocked(d) {
                Err(Blocked(format!("{d} is a local or intranet name")))
            } else {
                Ok(())
            }
        }
    }
}

/// Only the host: a public name or address (any scheme and port; DNS is checked at connect
/// by `GuardResolver`). For addresses other parts of RealmNest are handed, e.g. OAuth metadata.
pub fn host_is_public(url: &Url) -> bool {
    match url.host() {
        None => false,
        Some(url::Host::Ipv4(ip)) => is_public(IpAddr::V4(ip)),
        Some(url::Host::Ipv6(ip)) => is_public(IpAddr::V6(ip)),
        Some(url::Host::Domain(d)) => !host_name_blocked(d),
    }
}

/// Resolves a host and refuses it when any of its addresses is not public. reqwest connects to
/// exactly the addresses returned here.
pub struct GuardResolver {
    pub policy: Policy,
}

pub const BLOCKED_MARK: &str = "realmnest-blocked-address";

impl Resolve for GuardResolver {
    fn resolve(&self, name: Name) -> Resolving {
        let policy = self.policy;
        Box::pin(async move {
            let host = name.as_str().to_string();
            let addrs: Vec<SocketAddr> =
                tokio::net::lookup_host((host.as_str(), 0)).await?.collect();
            if addrs.is_empty() {
                return Err(format!("{host} has no address").into());
            }
            // the port is not known here: the test policy only allows its own loopback port at connect
            if let Some(bad) = addrs
                .iter()
                .find(|a| !policy.ip_allowed(a.ip(), policy.test_loopback_port.unwrap_or(0)))
            {
                return Err(format!("{BLOCKED_MARK}: {host} resolves to {}", bad.ip()).into());
            }
            let out: Addrs = Box::new(addrs.into_iter());
            Ok(out)
        })
    }
}

#[cfg(test)]
pub(crate) fn host_blocked_for_tests(h: &str) -> bool {
    host_name_blocked(h)
}
