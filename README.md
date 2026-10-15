# RealmNest OS · 0.11.0 Public Beta

RealmNest OS is a visual operating environment for AI agents: a local-first Windows desktop app where you create agents, give them roles and AI models, and watch them work as pixel-art characters in isometric worlds. It looks like a cozy management game; underneath, the agents are real: they chat, use tools with your approval, read your documents and the web, remember what you allow, work together in crews and run scheduled workflows.

> **Public beta.** Windows 10/11 only. Expect rough edges; read the [known limitations](docs/HARDENING.md#known-limitations) before you rely on it. Formerly called Nestra ([docs/REBRAND.md](docs/REBRAND.md)).

## What it does

- **Worlds and agents.** Ten hand-made worlds (Office, Factory, Farm, Space Station, Chemical Lab, Creative Studio, Robotics Workshop, Data Center, Research Hub, Port). Create as many agents as you like, dress them, move them between worlds. In **Mock** mode they act out pretend work; in **Live** mode an agent you give a task to runs it for real, and its character works only while the run goes.
- **Chat** with an agent or directly with a model; conversations persist and remember. Attach images and PDFs.
- **AI connections**: Claude with your account (through Claude Code), ChatGPT with your account (through the Codex CLI), API keys for Anthropic, OpenAI and OpenRouter, and Ollama for models running on your PC. Choose the model and the effort level per chat and per agent; a ring shows what you are using.
- **Tools with approval**: agents read and write files in a folder you choose, and medium-risk actions always ask you first. **MCP** servers add their tools under the same rules. **Skills** are portable instructions agents can follow; they never run code.
- **Knowledge**: index your documents (PDF, Markdown, DOCX, CSV, JSON, text); answers cite them and every citation is checked.
- **Memory**: each agent proposes what to remember; you approve. Memories stay with their agent.
- **Web**: with the Web on, agents read public pages safely and cite them. **Deep Research** plans, reads, verifies quotes and writes a report with sources.
- **Delegation, Crews and Workflows**: agents hand work to colleagues; a crew plans a goal you approve and delivers a result you approve; workflows run agent tasks, tools, crews, approvals and conditions, on demand or on a schedule.
- **Telegram**: pair a bot and use RealmNest from your phone, approvals included.
- **Sound**: music and world ambience generated on the fly (off by default: the switch is on the Home map).
- Interface in Italian and English.

## Install

1. Download `RealmNest-OS_0.11.0_x64-setup.exe` and its checksum from the release page; check it with `Get-FileHash RealmNest-OS_0.11.0_x64-setup.exe` (SHA-256).
2. Run it. It installs for your Windows user only (no administrator rights) and adds RealmNest OS to the Start menu. The installer and the app are **not code-signed** yet, so Windows SmartScreen may say "Windows protected your PC": choose *More info › Run anyway* only if the checksum matches.
3. RealmNest needs the Microsoft Edge WebView2 Runtime, which Windows 11 and updated Windows 10 already have; the installer fetches it if missing.

Uninstalling (Settings › Apps) removes the program and keeps your data unless you tick the box to delete it. Where data lives, what leaves your PC and how to remove everything: [docs/PRIVACY.md](docs/PRIVACY.md).

## First run

RealmNest opens on the Home map with a demo crew in Mock mode: nothing needs an account. To use real AI:

1. **Settings › AI connections**: connect at least one provider.
   - *Claude* (your Claude account): needs the [Claude Code](https://claude.com/claude-code) CLI; RealmNest signs you in.
   - *ChatGPT* (your ChatGPT account): needs the [Codex CLI](https://github.com/openai/codex/releases) (`codex.exe` on PATH, or set `REALMNEST_CODEX_PATH` to its file or folder).
   - *Anthropic API*, *OpenAI API*, *OpenRouter*: paste an API key; it is stored in Windows Credential Manager.
   - *Ollama*: install [Ollama](https://ollama.com) and pull a model; RealmNest starts it when needed and stops it when RealmNest closes.
2. **Chat**: pick the connection and model next to the composer and write.
3. **Simulation › Controls › Live**, select an agent in the world and give it a task.
4. Optional: Settings › Integrations for Web settings, MCP servers and Telegram; Settings › General › Tools for the work folder.

Back up your data any time from **Settings › General › Data › Export a backup**.

## Build from source

Requirements: Windows 10/11, Node.js 18+, Rust (stable, MSVC toolchain) with the Visual Studio C++ build tools, WebView2. See [docs/TAURI.md](docs/TAURI.md) for details.

```bash
npm ci
npm run dev                              # browser build at http://localhost:5173 (Mock mode, no native features)
npm run tauri dev                        # desktop app in development
npm run typecheck && npm test            # TypeScript + Vitest
cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings
npm run tauri build -- --bundles nsis    # release exe + Windows installer
```

## Documentation

Feature and architecture docs are in [docs/](docs/README.md): runtime, chat, connections and providers, capabilities and routing, tools, MCP, Skills, files, Knowledge, Memory, Web, Deep Research, delegation, crews, workflows, Telegram, audio, UI. Release state: [docs/STATUS.md](docs/STATUS.md), [docs/HARDENING.md](docs/HARDENING.md), [CHANGELOG.md](CHANGELOG.md).

## Project layout

| path | what |
| --- | --- |
| `src/` | the app (TypeScript, React): `ui/` screens, `runtime/` agents, chat, tools, MCP, Skills, Knowledge, Memory, Web, crews, workflows, Telegram; `render/` and `engine/` the worlds; `tests/` Vitest |
| `src-tauri/` | the native side (Rust, Tauri 2): process host for the CLIs, provider HTTP hosts, files, secrets, MCP, web reader, Telegram |
| `public/` | the baked world pictures and the Home map |
| `tools/` | the character pipeline (`charpipe`, partly used by the app), world bake helpers, release scripts |
| `examples/skills/` | sample Skills |
| `docs/` | documentation |

## Privacy and security

RealmNest has no telemetry, analytics, crash reporter or update check. Your data stays on this PC; something leaves it only when you use a provider or an integration you set up — see [docs/PRIVACY.md](docs/PRIVACY.md). To report a vulnerability, follow [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Copyright (C) 2026 Marius Alexandru Pisaru.

RealmNest OS is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; see [LICENSE](LICENSE).

Third-party components and their licences: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Art and other assets: [ASSETS.md](ASSETS.md).
