# Security

## Reporting a vulnerability

Please report security problems privately, not in a public issue: on the GitHub repository use **Security › Report a vulnerability** (private vulnerability reporting). Include the RealmNest OS version (Settings › General › Information), your Windows version, what you did, what happened and, if you can, a minimal way to reproduce it. You will get an acknowledgement, and a fix or a mitigation is prioritised over new features.

## Supported versions

RealmNest OS 0.14.0 is a public beta for Windows 10 and 11. Only the latest beta receives fixes. From 0.13.0 RealmNest updates itself from the GitHub releases, and installs an update only if its signature matches the key built into the app (see docs/UPDATES.md); older versions install the newest release over the old one (your data is kept). Releases are not code-signed yet; check the SHA-256 published with each installer.

## Threat model in short

RealmNest is local-first: your agents, chats, memories, knowledge and files stay on this PC, and nothing is sent anywhere unless you connect a provider or an integration (see [docs/PRIVACY.md](docs/PRIVACY.md)). The app trusts you, the person at the keyboard. It does **not** trust:

- **model output** — a model can be manipulated by what it reads. Every action a model asks for goes through the ToolRuntime: the tool must be allowed for that agent, and medium-risk actions (writing files, delegating, deep research, MCP tools) ask you first. Approvals belong to one call and cannot be replayed.
- **web pages, documents, memories and MCP results** — they are data, framed as untrusted content in prompts, never instructions. Web fetches go to public addresses only (no localhost, private or link-local networks, re-checked on every redirect); the hidden reader for JavaScript pages has no access to RealmNest, no cookies, no downloads, no pop-ups.
- **MCP servers** — local servers run only after a native Windows consent dialog that shows exactly what will run; online servers must use https; their tools always ask before running unless you allow them; their secrets stay in Windows Credential Manager and are only sent to the server's own address.
- **Skills** — instructions and resources only: scripts and executables are refused, and a Skill can never give an agent a tool you did not give it.
- **Telegram** — only accounts you paired (by numeric id, in private chats) are served; a message is ordinary user input and goes through the same permissions and approvals as on the PC.
- **files to open** — only documents and media open with their app; programs and scripts are refused, and opened copies carry the "downloaded from the internet" mark.

Secrets (API keys, tokens, the Telegram bot token) live in Windows Credential Manager. The app's page can store them but never read them back; they are never logged, exported or put in backups.

Claude Code and Codex run with their own tools switched off, in RealmNest's own folders, with project settings and hooks ignored; RealmNest tools reach them only through a loopback bridge with a one-time token.

## Out of scope

Malware already running as your Windows user can read your files and your Credential Manager entries; RealmNest cannot defend against that. The CLIs you install (Claude Code, Codex, Ollama) and the providers you connect have their own security and privacy terms.
