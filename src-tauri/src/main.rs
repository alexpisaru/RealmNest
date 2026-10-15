// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // started by Claude Code as RealmNest's MCP bridge: relay stdio to the running app, no window
    if std::env::args().nth(1).as_deref() == Some("--mcp-bridge") {
        std::process::exit(realmnest_lib::mcp::bridge::run_relay());
    }
    realmnest_lib::run()
}
