# RealmNest OS 0.11.1 Public Beta

A hotfix for 0.11.0 Public Beta.

## Fixed

- Fixed an issue where development/demo agents could appear automatically on a fresh installation. New installations now start with a clean workspace.
- A new installation no longer adds an AI connection by itself (before, a Claude connection appeared when the Claude Code CLI was signed in on the PC): every connection is one you add in Settings › AI connections.
- Existing user data is not affected: an existing profile opens exactly as it was, including one where every agent was deleted (before, the demo agents came back in that case too).
- The sample agents are still available, only on request: Settings › General › Data › **Load the demo team**.

## Install

- Download `RealmNest-OS_0.11.1_x64-setup.exe` and `SHA256SUMS.txt`; check the installer with `Get-FileHash RealmNest-OS_0.11.1_x64-setup.exe` and compare.
- Run it: it installs for your Windows user, no administrator rights, with a Start-menu entry and an uninstaller. To upgrade from 0.11.0, install over it: your data stays.
- It is **not code-signed**: Windows SmartScreen may show "Windows protected your PC". Choose *More info › Run anyway* only if the checksum matches.
- Requires Windows 10 or 11 (64-bit) and the Microsoft Edge WebView2 Runtime (already on Windows 11; the installer fetches it if missing).

## What a new installation contains

No agents, AI connections, crews, workflows, schedules, chats, memories, Knowledge bases of yours, artifacts, MCP servers, Skills of yours, Telegram pairing or saved keys. What ships with the app: the ten worlds, the built-in **RealmNest Docs** Knowledge base (this version's documentation), the built-in **Workspace Note** Skill and crew and workflow **templates** you can pick when creating one. No AI connection: add one in Settings › AI connections.

## Known limitations

Unchanged from 0.11.0: see `docs/RELEASE_NOTES_0.11.0.md` and `docs/HARDENING.md` (Windows 10, offline use and real display scaling not tested; not code-signed; last seconds of changes can be lost on an abrupt stop; Skills over 14,000 characters cannot run; some messages in English).

## Licence

GNU AGPL v3 or later. Copyright (C) 2026 Marius Alexandru Pisaru. Third-party notices are in THIRD_PARTY_NOTICES.md.
