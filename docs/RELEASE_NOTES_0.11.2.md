# RealmNest OS 0.11.2 Public Beta

A small update to 0.11.1 Public Beta, mostly the installer.

## Fixed

- **Upgrading no longer looks like a crash.** When an older RealmNest was installed, the installer offered "uninstall before installing" by default. It then hid its own window and opened the old version's uninstaller, which has a "delete app data" box. Now an upgrade simply installs over the old version, and your data stays where it is.
- **"Run RealmNest OS" on the installer's last page starts the app right away.** Before, it went through Windows Explorer and could leave the installer hidden for a long time without starting the app.
- **The Exit button closes RealmNest.** Before, it left an empty white window, and only the window's X closed the app.
- **Claude and ChatGPT connections say what you need.**
  - The folder field no longer claims "the account already signed in on this computer".
  - The form explains that Claude Code (Claude) or the Codex CLI (ChatGPT) must be installed.
  - Signing in without it tells you what to install.

## New

- The installer shows the RealmNest logo.

## Install

- Download `RealmNest-OS_0.11.2_x64-setup.exe` and `SHA256SUMS.txt`. Check the installer with `Get-FileHash RealmNest-OS_0.11.2_x64-setup.exe` and compare the result with the checksum.
- Run it. It installs for your Windows user with no administrator rights, and adds a Start-menu entry and an uninstaller.
- To upgrade from 0.11.0 or 0.11.1, run the new installer: it installs over the old version and keeps your data.
- It is **not code-signed**, so Windows SmartScreen may show "Windows protected your PC". Choose *More info › Run anyway* only if the checksum matches.
- Requires Windows 10 or 11 (64-bit) and the Microsoft Edge WebView2 Runtime. Windows 11 already has it; the installer downloads it if it is missing.
- To use a Claude or ChatGPT account, install [Claude Code](https://claude.com/claude-code) or the [Codex CLI](https://github.com/openai/codex) first. API keys and Ollama need neither.

## Known limitations

Unchanged from 0.11.0 and 0.11.1. See `docs/RELEASE_NOTES_0.11.0.md` and `docs/HARDENING.md`.

## Licence

GNU AGPL v3 or later. Copyright (C) 2026 Marius Alexandru Pisaru. Third-party notices are in THIRD_PARTY_NOTICES.md.
