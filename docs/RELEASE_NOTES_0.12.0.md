# RealmNest OS 0.12.0 Public Beta

ChatGPT can now search the web, and a few fixes.

## New

- **Deep Research with ChatGPT searches the web.** A ChatGPT (account) connection uses OpenAI's own web search for Deep Research, as Claude uses its own. The results come from the search itself, and RealmNest then reads each page through its Web layer: private addresses are blocked and citations are checked.
- **ChatGPT on the web in chats and agent tasks.** With **Web** on (and Knowledge not in STRICT mode), ChatGPT can search the web during a turn, next to RealmNest's tools. It usually finds pages with its own search and then has RealmNest read them, asking you first for addresses you did not write yourself. With Web off nothing changes. Pages ChatGPT opens only with OpenAI's search are not read by RealmNest, so they get no [W] labels or citation checks; the model is asked to name them (title and address).

## Fixed

- **ChatGPT rate limits no longer look like a hang.** When ChatGPT refuses requests from your account for a while (429 "Too Many Requests"), the Codex CLI waits silently for minutes before retrying. RealmNest now notices and stops the turn at once with a clear message ("ChatGPT is limiting requests from this account for now… Try again later"). With ChatGPT, Deep Research also runs one model turn at a time to avoid those limits.
- **RealmNest can always be closed.** A program that closes "the main window" of another (PowerShell's `CloseMainWindow()`, some scripts and tools) could hit the hidden window RealmNest's event loop runs on. From then on the app could not be closed: neither Exit nor the window's X worked. Such a close now closes RealmNest normally.

## Install

- Download `RealmNest-OS_0.12.0_x64-setup.exe` and `SHA256SUMS.txt`, then check the installer with `Get-FileHash RealmNest-OS_0.12.0_x64-setup.exe` and compare the result with the checksum.
- Run the installer. It installs for your Windows user, with no administrator rights. To upgrade from an earlier 0.11 version, run the new installer: it installs over the old version and keeps your data.
- The installer is **not code-signed**, so Windows SmartScreen may show "Windows protected your PC". Choose *More info › Run anyway* only if the checksum matches.
- RealmNest needs Windows 10 or 11 (64-bit) and the Microsoft Edge WebView2 Runtime. Windows 11 already has WebView2; on other systems the installer downloads it.
- ChatGPT (account) connections need the [Codex CLI](https://github.com/openai/codex), and Claude (account) connections need [Claude Code](https://claude.com/claude-code).

## Known limitations

- Each ChatGPT web search uses part of your ChatGPT plan, about 35,000–40,000 input tokens, most of them cached. A Deep Research run makes about twenty ChatGPT requests, and the plan's rate limit can stop it. Claude is the more reliable choice for long research.
- The rate-limit message is in English, like other provider messages.
- All other limitations are unchanged from 0.11: see `docs/RELEASE_NOTES_0.11.0.md` and `docs/HARDENING.md`.

## Licence

GNU AGPL v3 or later. Copyright (C) 2026 Marius Alexandru Pisaru. Third-party notices are in THIRD_PARTY_NOTICES.md.
