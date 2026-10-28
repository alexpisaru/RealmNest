# RealmNest OS 0.13.0 Public Beta

RealmNest now updates itself, tells you when something needs you, searches the web with every provider and shows answers with their formatting.

## New

- **Automatic updates.** Shortly after start and every 6 hours RealmNest checks the newest GitHub release. When a newer version is out, a notice offers **Update now**, **What's new** and **Later**. The update is downloaded, its signature is checked against the key built into RealmNest, and the installer runs on its own: it installs over the old version, keeps your data and starts RealmNest again. Settings › General › About › Updates turns the automatic check off and has **Check for updates**. This is the first version with the updater: from 0.12.0 or older, install it by hand once.
- **Formatted answers.** Chat replies and agent task results show headings, lists (nested, numbered, checklists), tables, quotes, code blocks with a **Copy** button, bold, italics, strikethrough and links. Links open in your browser; [K] and [W] citations are still chips you can click. Nothing in an answer is ever run as HTML.
- **Web search for every provider.** With **Web** on, agents and chats search the web whatever runs them: OpenRouter, the OpenAI API, Ollama and providers added later search through one of your AI connections that can search (Claude or ChatGPT by account, the Anthropic API, OpenRouter), then read the pages through RealmNest as before. Settings › Integrations › Web › Search engine: **Automatic** (Claude first, then ChatGPT, the Anthropic API, OpenRouter; the next one tries when one fails), one connection, or **None**.
- **Claude searches the web in chats and agent tasks.** With Web on, a Claude (account) connection uses Claude's own web search during the turn, like ChatGPT since 0.12.0, next to RealmNest's tools. Every other Claude Code tool stays off.
- **Windows notifications.** While RealmNest is minimized or behind other windows, it tells you when your approval is needed (a tool call, a crew's plan or result, a workflow step, a research plan) and when work ends or fails (an agent's task, a crew, a workflow, a deep research). A click brings RealmNest back on it. Nothing shows while you are looking at RealmNest. Settings › General › Windows notifications: on/off for each kind, and **Try a notification**.
- **Log file and diagnostics.** RealmNest writes errors and key moments to a log file on your PC (`logs\realmnest.log` in its data folder), with keys, tokens, e-mail addresses and your user name removed, and never your prompts, answers or files. Settings › General › Diagnostics › **Export diagnostics** saves a text report (version, system, the state of connections and servers without names, the log) to attach when you report a problem; **Open the log folder** shows the file.

## Changed

- After an update, or with *Run RealmNest OS* in a silent or passive install, the installer starts RealmNest directly; the old way could hang.
- Claude and ChatGPT, which search by themselves, no longer also get RealmNest's `web_search` tool: they never search twice.
- Deep Research announces each status change, so a plan waiting for approval can be notified.

## Install

- Download `RealmNest-OS_0.13.0_x64-setup.exe` and `SHA256SUMS.txt`, then check the installer with `Get-FileHash RealmNest-OS_0.13.0_x64-setup.exe` and compare the result with the checksum.
- Run the installer. It installs for your Windows user, with no administrator rights. To upgrade from 0.12 or 0.11, run the new installer: it installs over the old version and keeps your data. From now on, RealmNest updates itself.
- The installer is **not code-signed**, so Windows SmartScreen may show "Windows protected your PC". Choose *More info › Run anyway* only if the checksum matches.
- RealmNest needs Windows 10 or 11 (64-bit) and the Microsoft Edge WebView2 Runtime. Windows 11 already has WebView2; on other systems the installer downloads it.
- ChatGPT (account) connections need the [Codex CLI](https://github.com/openai/codex), and Claude (account) connections need [Claude Code](https://claude.com/claude-code).

## Privacy

- The update check downloads `latest.json` from the newest GitHub release 15 seconds after start and every 6 hours; it sends nothing about you and can be turned off. The installer is downloaded only when you choose **Update now**.
- A web search from a chat on another provider (for example a local Ollama model) goes through the AI connection that searches, so the search words reach that provider. Choose **None** in Settings › Integrations › Web to keep search off.
- The log file stays on your PC; a diagnostics report is saved only when you export it.

## Known limitations

- A web search through ChatGPT uses about 35,000–40,000 input tokens of your plan (mostly cached), which is why Automatic tries Claude first.
- A model that cannot call tools gets no web search, only the pages you link.
- Clicking a notification after RealmNest was closed does nothing.
- The browser build (`npm run dev`) has no notifications, updates or log file.
- All other limitations are unchanged: see `docs/HARDENING.md`.

## Licence

GNU AGPL v3 or later. Copyright (C) 2026 Marius Alexandru Pisaru. Third-party notices are in THIRD_PARTY_NOTICES.md.
