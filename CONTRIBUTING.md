# Contributing to RealmNest OS

Thanks for helping. RealmNest OS is a Windows desktop app (Tauri 2: a React/TypeScript front end and a Rust native side). Contributions are accepted under the project's licence, the GNU AGPL v3 or later.

## Set up

- Windows 10/11, Node.js 18+, Rust stable with the MSVC toolchain and the Visual Studio C++ build tools, WebView2 (see [docs/TAURI.md](docs/TAURI.md)).
- `npm ci`, then `npm run dev` (browser build, Mock mode) or `npm run tauri dev` (desktop app).

## Before you open a pull request

Run everything that CI would run (there is no CI yet, so please run it yourself):

```bash
npm run typecheck          # tsc -b --noEmit
npm test                   # Vitest
cd src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

and, for changes to the desktop side, `npm run tauri build -- --no-bundle` and a manual check of the exe.

## Expectations

- One topic per pull request, with a short description of what changes for the user and how you checked it.
- Add or update tests for behaviour you change (`src/tests/*.test.ts`, Rust `#[cfg(test)]` modules).
- Match the surrounding style: no formatter config is enforced for TypeScript, so keep single quotes and the existing line lengths; do not reformat files you don't change. `cargo fmt` for Rust.
- UI text goes through `src/i18n.ts` / `src/locales/*` in Italian and English.
- Security boundaries are deliberate: argument allowlists for the CLIs exist twice (TypeScript and Rust) and must stay in step (`args.cases.json`); new native commands need `lib.rs`, `build.rs` and `capabilities/default.json`; tools always go through the ToolRuntime. See [docs/HARDENING.md](docs/HARDENING.md) and [SECURITY.md](SECURITY.md).
- Saved data keeps its old `nestra` identifiers on purpose ([docs/REBRAND.md](docs/REBRAND.md)); don't rename them.

## Security issues

Do not open a public issue for a vulnerability: follow [SECURITY.md](SECURITY.md).
