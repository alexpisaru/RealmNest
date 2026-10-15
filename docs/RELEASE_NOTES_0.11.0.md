# RealmNest OS 0.11.0 Public Beta

The first public beta of RealmNest OS: a visual operating environment for AI agents on Windows. Your agents live as pixel-art characters in ten isometric worlds; underneath, they really chat, use tools with your approval, read your documents and the web, remember what you allow, work together in crews and run scheduled workflows.

## Install

- Download `RealmNest-OS_0.11.0_x64-setup.exe` and `SHA256SUMS.txt`; check the installer with `Get-FileHash RealmNest-OS_0.11.0_x64-setup.exe` and compare.
- Run it: it installs for your Windows user, no administrator rights, with a Start-menu entry and an uninstaller.
- It is **not code-signed**: Windows SmartScreen may show "Windows protected your PC". Choose *More info › Run anyway* only if the checksum matches.
- Requires Windows 10 or 11 (64-bit) and the Microsoft Edge WebView2 Runtime (already on Windows 11; the installer fetches it if missing).

## What's in it

- **Worlds and agents**: ten hand-made worlds, unlimited agents with outfits, Mock mode (pretend work, no account needed) and Live mode (real tasks).
- **Chat** with agents or models, with attachments and conversations that remember.
- **AI connections**: Claude (your account, via Claude Code), ChatGPT (your account, via the Codex CLI), Anthropic / OpenAI / OpenRouter API keys, Ollama on your PC; model and effort level per chat and per agent; usage at a glance.
- **Tools with approval**, **MCP** servers, **Skills** (instructions, never code).
- **Knowledge** with checked citations, **Memory** per agent with your review, **Web** reading with citations, **Deep Research** reports.
- **Delegation, Crews, Workflows and schedules**.
- **Telegram** remote control, approvals included.
- Generated **music and ambience** (off by default), Italian and English interface.

## Safety and reliability (V1 hardening)

- Only documents and media open with their app; programs and scripts never do.
- Claude Code and Codex run with their own tools off, in RealmNest's own folders, ignoring project settings and hooks.
- Agents cannot reach system, account or RealmNest folders; medium-risk actions always ask; Skills and Telegram cannot bypass approvals.
- Secrets live in Windows Credential Manager, are never shown to the page or exported, and go only where they belong.
- Web pages and online sign-ins cannot reach your local network.
- No silent data loss: failed saves are shown, damaged data is kept aside, a broken part no longer stops the app (**Start safely** exists), removed files wait 30 days in a trash, and **Settings › General › Data** exports and restores a full backup.
- One RealmNest at a time; a crash keeps what was written and marks it interrupted.
- No telemetry, analytics, crash reporting or update checks.

## Known limitations

- Windows only; tested on Windows 11. **Not tested for this release: Windows 10, offline use, real display scaling** (125–200 % was checked by emulating the window sizes only).
- If RealmNest or Windows stops abruptly, the last few seconds of changes may be missing at the next start (WebView2 writes its storage with a short delay); a normal close saves everything.
- A first chat with a new Claude connection asks you to pick a model first (there is no default Chat route until you set one in Settings › AI capabilities).
- Skills whose instructions are longer than 14,000 characters install but cannot run yet (several of the public Anthropic Skills are larger).
- Very large tool results through Claude Code are kept by Claude Code in its own folder, where the model cannot read them; ask for smaller results.
- Not code-signed; no automatic updates (install the next version over this one).
- Most app data lives in WebView2 local storage (about 5 million characters): the app warns if a save fails; back up regularly.
- No OCR (scanned PDFs have no text); very large PDFs may be read partially.
- Web: public pages only, no logins; no search engine of its own (Deep Research uses the provider's search).
- Claude, ChatGPT and Ollama need their own programs; ChatGPT via Codex has no images or streaming.
- Telegram works only while RealmNest is open; voice messages are not transcribed.
- Some messages from external programs stay in English.

Full list: `docs/HARDENING.md`, section Known limitations.

## Upgrading

Earlier builds (including those named Nestra) keep their data: RealmNest reads the same data folder (`%LOCALAPPDATA%\app.nestra.desktop`) and secrets. Install over the old version; your data stays. If you used a Codex installed in a custom folder, set `REALMNEST_CODEX_PATH` to it.

## Licence

GNU AGPL v3 or later. Copyright (C) 2026 Marius Alexandru Pisaru. Third-party notices are in THIRD_PARTY_NOTICES.md.
