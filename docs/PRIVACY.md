# Privacy and data

RealmNest OS has **no telemetry, no analytics, no crash reporter and no update check**. (The Microsoft Edge WebView2 runtime that draws the window is part of Windows and keeps its own components up to date with Microsoft; RealmNest has no control over that traffic.) Fonts and icons are bundled; the app's page may only load its own files. Something leaves this PC only when you use a provider or an integration you set up.

## What is sent, to whom, when

| destination | when | what |
| --- | --- | --- |
| Anthropic (`api.anthropic.com`) | an Anthropic API-key connection is used | your prompts, attachments, tool results, the system prompt; the key from Credential Manager |
| OpenRouter (`openrouter.ai`) | an OpenRouter connection is used (chat, models, embeddings, credits) | the same, plus the header `X-Title: RealmNest OS` |
| OpenRouter (`openrouter.ai/api/v1/models`) | at most once a day, when a model menu opens, to show reference prices for ChatGPT and Claude models | a download of the public model list, no key and nothing about you ([PROVIDERS.md](PROVIDERS.md#prices-in-the-model-menus)) |
| OpenAI (`api.openai.com`) | an OpenAI API-key connection is used | prompts, files, embeddings |
| Ollama (`127.0.0.1:11434`) | an Ollama connection is used | stays on this PC |
| Claude Code / Codex CLIs | a Claude or ChatGPT account connection is used | prompts go to the CLI on this PC, which talks to Anthropic or OpenAI with your account; the CLIs' own data practices apply. Signing in opens the provider's page in your browser |
| Telegram (`api.telegram.org`) | only after you set a bot token and pair an account | messages, agent answers, files and pictures you exchange with the bot |
| GitHub (`api.github.com`, `raw.githubusercontent.com`) | only when you install or update a Skill from GitHub | read-only requests, no credentials |
| GitHub (`github.com`, release downloads) | 15 seconds after start and every 6 hours, unless you turn the automatic check off (Settings › General › About); and when you install an update | a download of `latest.json` (and of the installer when you choose Update now), no credentials and nothing about you ([UPDATES.md](UPDATES.md)) |
| any web address | only when Web is on for a chat or an agent, or for Deep Research, a Skill URL or an online MCP server you add | a normal page request (User-Agent `RealmNest/<version>`), public addresses only |
| an online MCP server | only servers you add | the tool calls and their arguments; its secret headers / OAuth token, only to that server's own address |

Deep Research searches through the connection's own provider (Claude's web search, Anthropic's web search tool, OpenRouter's web plugin).

## Where your data lives

| what | where |
| --- | --- |
| agents, chats, memories, knowledge catalogue, runs, workflows, settings, connection names | the app's local storage: `%LOCALAPPDATA%\app.nestra.desktop\EBWebView` (the `nestra` name is kept on purpose so data from earlier versions keeps working) |
| attachments, artifacts, knowledge chunks, report pictures (content-addressed, removed files kept 30 days in `trash`) | `%LOCALAPPDATA%\app.nestra.desktop\files` |
| installed Skills | `%LOCALAPPDATA%\app.nestra.desktop\skills` |
| MCP launch consent, Telegram pairing | `%LOCALAPPDATA%\app.nestra.desktop\mcp-trust.json`, `telegram.json` |
| API keys, tokens, bot token | Windows Credential Manager, entries for `app.nestra.desktop` |
| folders the Claude Code / Codex CLIs run in | `%USERPROFILE%\.nestra\workspace`, `%USERPROFILE%\.nestra\codex` |
| exports, reports, exported Skills, backups | `Documents\RealmNest Exports`, `Documents\RealmNest Skills` (if Documents is in OneDrive, these files sync with it) |
| your agents' work folders | the folders you choose |
| the program | `%LOCALAPPDATA%\RealmNest OS\` (`realmnest-os.exe`, `uninstall.exe`), a Start-menu shortcut, and an entry under Settings › Apps (per-user install, no administrator rights) |
| logs | `%LOCALAPPDATA%\app.nestra.desktop\logs\realmnest.log` (and `.1`, `.2`): errors and starts, redacted, never prompts, answers or file contents; at most about 3 MB ([DIAGNOSTICS.md](DIAGNOSTICS.md)). A diagnostics report is saved only when you export one. |
| Claude Code's own data | when you use a Claude account, the Claude Code CLI keeps its sessions, and sometimes large tool results, in its own folder `%USERPROFILE%\.claude` (Claude Code's behaviour, not RealmNest's) |

## Backup, reset, uninstall

- **Backup**: Settings › General › Data › Export a backup writes every record of the app's local storage to one file; Import restores it. Files (attachments, artifacts) stay in the app data folder; secrets are never included.
- **Load the demo team** (Settings › General › Data) replaces agents and settings with 12 sample agents, only when you ask; chats, knowledge and files are kept. A new installation starts with no agents.
- **Uninstall** (Settings › Apps › RealmNest OS) removes the program, the Start-menu shortcut and the Apps entry and **keeps your data** (checked on 0.11.0: the data folder stays and a reinstall finds everything). The uninstaller also offers to delete the app data. Saved keys and tokens in Windows Credential Manager always stay until you remove them. To remove everything, also delete `%LOCALAPPDATA%\app.nestra.desktop`, `%USERPROFILE%\.nestra`, the `app.nestra.desktop` entries in Windows Credential Manager (Control Panel › Credential Manager › Windows Credentials) and, if you want, the RealmNest folders in Documents.
- **Reinstall / upgrade**: install the new version over the old one; data, settings, connections, keys and Telegram pairing are kept (checked from a previous build's data to the 0.11.0 installer).
- `ollama serve` started by RealmNest is stopped when RealmNest closes; an Ollama you started yourself is left alone.
