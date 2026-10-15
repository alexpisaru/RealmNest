# Desktop build with Tauri 2

RealmNest is a local-first desktop app. The web beta already runs without a server. Moving to Tauri wraps the same `dist/` in a native window, then swaps two adapters.

> **Status:** the desktop app compiles and runs (`npm run tauri dev`), and the native process host runs Claude Code from it. See "Local providers" below and [PROVIDERS.md](PROVIDERS.md).

## What already makes this easy

| Concern | Where | Status |
| --- | --- | --- |
| No server assumptions | `vite.config.ts` `base: './'`, fonts bundled with `@fontsource`, no CDN | done |
| Persistence behind a port | `src/persistence/storage.ts` (`StorageAdapter`) | localStorage today |
| Platform calls behind a seam | `src/platform/index.ts` (`isDesktop`, `exitApp`) | browser fallback |
| Engine without DOM | `src/engine`, `src/runtime`, `src/store` (tested in Node) | done |
| Window config, CSP, capabilities | `src-tauri/tauri.conf.json`, `src-tauri/capabilities/` | done |
| Local programs (Claude Code) | `src-tauri/src/process`, `src-tauri/src/programs` | done (Windows) |

## First run

1. Prerequisites: Rust (stable, MSVC), Visual Studio Build Tools with the C++ workload, and WebView2 (preinstalled on Windows 11). See <https://tauri.app/start/prerequisites/>.
   - The toolchains can live on another drive: set `RUSTUP_HOME`, `CARGO_HOME` (its `bin` is on the user PATH).
   - The cargo build folder can be moved too, with `CARGO_TARGET_DIR`.
   - Open a new terminal after installing, so these variables are loaded.
2. The Tauri CLI and JS API are already in `package.json` (`@tauri-apps/cli`, `@tauri-apps/api`).
3. Icons are generated from `public/favicon.svg` into `src-tauri/icons/` (`npx tauri icon public/favicon.svg -o src-tauri/icons`).
4. Run and package:

   ```bash
   npm run tauri dev
   npm run tauri build
   ```

## Swaps to make in Phase 2

### Quit button

`src/platform/index.ts`:

```ts
import { getCurrentWindow } from '@tauri-apps/api/window';
export async function exitApp() {
  if (isDesktop()) { await getCurrentWindow().close(); return true; }
  …
}
```

The capability `core:window:allow-close` is already granted.

### SQLite persistence

Add `tauri-plugin-sql` (lines are commented in `Cargo.toml` and `lib.rs`) and an adapter that implements the same interface:

```ts
import Database from '@tauri-apps/plugin-sql';
export class SqliteAdapter implements StorageAdapter {
  readonly kind = 'sqlite';
  private db = Database.load('sqlite:realmnest.db').then(async (db) => {
    await db.execute('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    return db;
  });
  async get<T>(k: string) {
    const rows = await (await this.db).select<{ v: string }[]>('SELECT v FROM kv WHERE k = $1', [k]);
    return rows[0] ? (JSON.parse(rows[0].v) as T) : undefined;
  }
  async set<T>(k: string, v: T) {
    await (await this.db).execute('INSERT INTO kv (k, v) VALUES ($1, $2) ON CONFLICT(k) DO UPDATE SET v = $2', [k, JSON.stringify(v)]);
  }
  async remove(k: string) { await (await this.db).execute('DELETE FROM kv WHERE k = $1', [k]); }
}
```

Then in `src/persistence/storage.ts` → `defaultAdapter()`, return `new SqliteAdapter()` when `isDesktop()`. The key/value layout keeps migration trivial. Proper tables (characters, runs, events) can come later behind `RealmNestRepository`.

### Real agents

Local agents (Claude Code, Ollama) need process and network access. That belongs in Rust commands or sidecars exposed through Tauri. They must never be called directly from the webview. The webview keeps talking to an `AgentRuntime` (see `src/runtime/types.ts`), and a `LiveRuntime` forwards commands to Rust and re-publishes runtime events on the bus.

### Local providers (process runner)

The desktop app runs local CLIs through a native host in Rust, with the same `ProcessRunner` contract as the dev bridge, so the provider code is identical in both. Details are in [PROVIDERS.md](PROVIDERS.md#running-local-programs-srcruntimeprocess).

| file | role |
| --- | --- |
| `src-tauri/src/commands.rs` | the three commands the webview may call: `process_run`, `process_cancel`, `process_locate` |
| `src-tauri/src/process/mod.rs` | `ProcessHost`: run registry with ids, validation, spawn without a shell, line streaming, timeouts, cancel |
| `src-tauri/src/process/tree.rs` | Windows Job Object per run (kills the whole tree; kill-on-close if RealmNest dies) |
| `src-tauri/src/process/protocol.rs` | wire types, identical to `src/runtime/process/protocol.ts` |
| `src-tauri/src/programs/claude.rs` | Claude Code: discovery, argument allowlist, environment, default cwd |
| `src/runtime/process/tauri.ts` | `TauriProcessRunner` (invoke + Channel) |

**Permissions added.** `build.rs` declares the three commands in the app manifest. Tauri then generates `allow-process-run`, `allow-process-cancel` and `allow-process-locate`, and `capabilities/default.json` grants exactly those to the `main` window. No shell, fs or other plugin is enabled.

**Tests.** `cargo test` (in `src-tauri/`) covers:
- the allowlist and the protocol, against the shared JSON cases;
- discovery (order, newest bundled version);
- environment cleaning;
- real runs with node standing in for a CLI: streaming, exit codes, refusals, cancel by id, concurrent runs, timeout, and the death of grandchildren.
