# Log and diagnostics

RealmNest keeps a log file of what went wrong, so a problem can be looked at after the fact, and makes a diagnostics report you can attach when you report one.

## The log file

`%LOCALAPPDATA%\app.nestra.desktop\logs\realmnest.log`, one line per entry:

```
2026-10-29T08:14:03.512Z error chat: run c-8f2a: rate_limited: ChatGPT is limiting requests from this account for now…
2026-10-29T08:15:40.020Z warn  mcp: photocraft: failed: the server stopped
```

- **Time** in UTC, **level** (`info`, `warn`, `error`), **source**, **message** on one line (at most 2,000 characters on the native side, 600 from the page).
- **Rotation:** at 1 MB the file becomes `realmnest.1.log` (the old `.1` becomes `.2`); two old files are kept, so the log never takes more than about 3 MB.
- **What goes in:**
  - RealmNest starting and closing (with the version);
  - native crashes (a panic in Rust, with the source file and line);
  - page errors and unhandled promise rejections;
  - `console.error` (where services report what did not start);
  - a save that failed (the keys and the error);
  - failed agent tasks and chat replies (code and message);
  - failed tool calls (tool and error code);
  - MCP servers that failed or are unavailable;
  - connections that became unavailable, invalid or in error;
  - failed crew tasks and crew warnings; failed, timed-out or over-budget workflow runs;
  - documents that could not be indexed, artifacts that could not be kept.
- **What never goes in:** prompts, answers, chat or file contents, tool inputs and outputs, secrets. Every message is redacted in the page before it is written (`redact` in `src/runtime/diagnostics/log.ts`): API keys (`sk-…`, `ghp_…`, `AIza…`), bearer tokens, Telegram bot tokens, `key=value` secrets, e-mail addresses and the user name in `C:\Users\<name>` paths.
- Entries are written in batches (at most one write a second); a log that cannot be written never stops RealmNest. The last 300 entries of the session are also kept in memory.

## The diagnostics report

Settings › General › **Diagnostics** › **Export diagnostics** saves one text file (`RealmNest diagnostics <date>.txt`) through the Save dialog:

- version, date, build (desktop or browser), system (the WebView's user agent), interface language;
- connections as kind and status only (`claude-code: connected`), MCP servers as status and tool count only: no names;
- storage health: failed writes, unreadable keys, the previous session's failed write, services that did not start;
- counts: agents, chats, crews, workflows, research runs;
- the newest 512 KB of the log (whole lines), or this session's entries in the browser build.

The whole report is redacted again before it is saved. **Open the log folder** selects the log file in Explorer.

## Where it lives

| | |
| --- | --- |
| native | `src-tauri/src/applog.rs`: `AppLog` (write, rotate, read), the panic hook; commands `log_write`, `log_read`, `log_reveal` in `commands.rs` |
| page | `src/runtime/diagnostics/log.ts`: `AppLog`, `redact`, `wireLog`; `report.ts`: `diagnosticsReport` |
| UI | `DiagnosticsCard` in `src/ui/screens/Settings.tsx` |
| tests | `src/tests/diagnostics.test.ts`; `applog.rs` tests dates, one-line entries and rotation |

## Limits

- The browser build writes no file: the entries stay in memory until the page closes.
- An error that happens before the page has started (a crash while the window opens) is in the log only if it is a native panic.
- The redaction removes known secret formats; a secret in an unknown format inside an error message could remain. Look at the report before you send it.
