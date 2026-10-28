# Updates

RealmNest updates itself from its GitHub releases, and only when you agree.

- **Check.** 15 seconds after start, then every 6 hours, RealmNest reads `latest.json` from the newest release (`https://github.com/alexpisaru/RealmNest/releases/latest/download/latest.json`). Settings › General › About › **Updates**: the automatic check on/off, **Check for updates** now, and what the last check said.
- **Offer.** When the release is newer, a notice in the bottom right says so, with **Update now**, **What's new** (the release notes, drawn as Markdown) and **Later**. Later hides it until the next start or a manual check. An automatic check that fails (offline, GitHub down) stays out of the way: only Settings shows it.
- **Install.** What is waiting to be saved is written first. Then the installer is downloaded (with progress), its **signature is verified** against the public key built into RealmNest, and it runs in passive mode (a small progress window, no questions). It installs over the old version, keeps your data and starts RealmNest again.
- **Log.** The check that found an update and the start of an install go to the log ([DIAGNOSTICS.md](DIAGNOSTICS.md)).

## Security

- An update runs only if its installer was signed with RealmNest's private key: a file changed on the way, or put on GitHub by someone else, is refused (`tauri-plugin-updater`, minisign signatures).
- The page cannot reach the plugin itself: no `updater:*` permission is granted. It has two commands, `update_check` and `update_install` (`src-tauri/src/update.rs`), and install only takes the update the last check found.
- HTTPS only. The test builds used a local address with `dangerousInsecureTransportProtocol`; release builds never do.

## Where it lives

| | |
| --- | --- |
| native | `src-tauri/src/update.rs` (commands, the pending update); the plugin in `lib.rs`; `plugins.updater` in `tauri.conf.json` (public key, endpoint, passive install); `bundle.createUpdaterArtifacts` |
| installer | `src-tauri/installer/installer.nsi`: an update (`/UPDATE /P /R`) installs over the old version and starts RealmNest with `Exec` (not `RunAsUser`, which could hang) |
| page | `src/runtime/update/service.ts` (`UpdateService`: schedule, state, settings under `updates`) |
| UI | `src/ui/update/UpdateViews.tsx`: `UpdateNotice` (shell), `UpdateSettings` (Settings › General › About) |
| release | `tools/updater-manifest.mjs` writes `latest.json` |
| tests | `src/tests/updates.test.ts` |

## The signing key

- Private key: `D:\RealmNest-keys\realmnest-updater.key` (no password), **never** in the repository. Public key: the `.pub` next to it, copied into `tauri.conf.json`.
- **Keep a copy of the private key somewhere safe** (a USB drive, a password manager). Without it no new version can be signed, and installed copies stop updating: they would need a manual install of a version with a new key.

## Making a release with updates

1. Build the installer with the key in the environment (the build fails without it, because `createUpdaterArtifacts` is on):
   ```
   set TAURI_SIGNING_PRIVATE_KEY=D:\RealmNest-keys\realmnest-updater.key
   set TAURI_SIGNING_PRIVATE_KEY_PASSWORD=
   npm run tauri build
   ```
   Next to `RealmNest-OS_<version>_x64-setup.exe` it writes `RealmNest-OS_<version>_x64-setup.exe.sig`.
2. Write the manifest: `node tools/updater-manifest.mjs <path to the setup.exe> docs/RELEASE_NOTES_<version>.md`. It writes `latest.json` next to the installer, pointing at `https://github.com/alexpisaru/RealmNest/releases/download/v<version>/<installer name>`.
3. Publish the GitHub release with tag `v<version>` and attach **the installer, `latest.json`** (and `SHA256SUMS.txt` as before). The `.sig` is inside `latest.json`; attaching it too does no harm.
4. The release must be the **latest** one (not a pre-release or a draft): installed copies read `releases/latest`.

## Tested

On 29 October 2026, with two signed test builds of a separate app ("RealmNest Showcase", its own install folder) and a local server standing in for GitHub: 0.12.98 found 0.12.99 at start, showed the notice and the notes, downloaded and verified it on **Update now**, closed, installed it in passive mode and started again as 0.12.99 about 12 seconds later. The log has each step. The test app was then uninstalled.

## Limits

- Copies before the first version with the updater (0.12.0 and older) cannot update themselves: that version has to be installed by hand once.
- The installer is not code-signed, so Windows SmartScreen may still warn on a manual install (the update itself runs without the warning).
- Windows only, like the app.
