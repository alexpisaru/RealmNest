# RealmNest OS 0.11.2 Public Beta — release candidate

| | |
| --- | --- |
| date | 16 October 2026 |
| source | local Git repository `release-staging/RealmNest-OS-0.11.2`, branch `main`, 1,197 files. Its history continues 0.11.1 (`101f3d0`). **Build commit `cb216a3`**; a later commit adds only this report and other docs that are not built into the app |
| installer | `RealmNest-OS_0.11.2_x64-setup.exe`, 86,754,915 bytes (82.7 MiB), NSIS, x64, per-user |
| SHA-256 | `f2b27eed785c5b949024a337298f72cf0b6e97e2b5756ed7ab4c4e40471a5abb` |
| artifacts | `release-artifacts/RealmNest-OS-0.11.2-Public-Beta/`: the installer, `SHA256SUMS.txt`, `RELEASE_NOTES.md` |
| verdict | **READY FOR 0.11.2 PUBLIC BETA** |

Nothing was pushed, tagged or published.

## Changes since 0.11.1

| commit | change |
| --- | --- |
| `1041a77` | Claude and ChatGPT forms no longer say "the account already signed in on this computer". The placeholder is "Default", and the help says Claude Code or the Codex CLI must be installed. Signing in without the CLI explains what to install, in the interface language. |
| `280a1f2` | Exit closes the main window through Tauri, the same way as its X. `window.close()` only tore the page down and left a white window. |
| `a19e903` | Installer logo: a sidebar on the welcome and finish pages, a header image and the installer icon. `tools/installer-images.ps1` draws them. |
| `de3146c` | The connection name example names the provider ("es. ChatGPT di lavoro"), not a person. |
| `b0dfaa6` | Upgrades install over the old version (see below). |
| `c2e9cb2` | "Run RealmNest OS" starts the app directly (see below). |
| `470ed13`, `b02d73a`, `cb216a3` | version 0.11.2 and the CHANGELOG |

### Installer

RealmNest now builds its installer from Tauri's own NSIS template (tauri-bundler 2.12.2), stored as `src-tauri/installer/installer.nsi` and set through `bundle.windows.nsis.template`. It contains two marked changes; everything else is byte-for-byte Tauri's template.

- **Upgrading: RealmNest** (`PageReinstall`). Tauri offered "uninstall before installing" by default when it found an older version.
  - That choice hid the installer window and ran the old uninstaller with its own window and its "delete app data" box. To the user it looked like a crash, and it risked data loss.
  - An upgrade now skips that page and installs over the old version, as a silent install or Tauri's updater does.
  - The choices for the same version and for a downgrade are unchanged. A WiX (MSI) install is still removed first.
- **Run RealmNest** (`RunMainBinary`). The finish page started the app with `nsis_tauri_utils::RunAsUser`, which goes through Explorer.
  - On this PC it once kept the installer hidden for over 3 minutes without starting the app, and once took about 70 seconds.
  - The installer is per user and never elevated, so it now uses `Exec`.

The report of a "very slow" installer could not be reproduced as slowness. All the long waits measured on this PC came from the test automation's clicks or from the owner closing a window by hand. Measured times are below.

## Automated checks (from the release tree)

| check | result |
| --- | --- |
| release tree | a fresh `git clone` of the development repository. It equals the public set (`tools/release-files.mjs`) byte for byte: 1,197 files, 0 different |
| dependencies | `npm ci --offline` from the lockfile |
| TypeScript (`tsc -b --noEmit`) | clean |
| Vitest | 827 tests in 47 files, all passing |
| Rust (new, empty target folder) | `cargo fmt --check` clean; `clippy --all-targets -D warnings` clean; 170 tests passing |
| release build | `npm run tauri build -- --bundles nsis`; the rendered `installer.nsi` contains both changes, the images and the icon |

## Installed-release acceptance

The installer was run outside the developer session's sandbox and driven through its pages. The owner's data was copied to a backup and set aside first; afterwards it was put back and compared.

| test | result |
| --- | --- |
| clean install (GUI), program and data absent | PASS: <ul><li>welcome (logo sidebar), licence (logo header), folder, installing about 7 s, completed, finish (logo sidebar);</li><li>about 29 s through all pages; Close ends the installer in under 4 s and the app starts;</li><li>version 0.11.2 in Apps;</li><li>Start-menu entry present.</li></ul> |
| first launch | PASS: <ul><li>three keys only;</li><li>0 agents and 0 connections.</li></ul> |
| connection forms | PASS: <ul><li>Claude: "Predefinita" and "Serve Claude Code installato…";</li><li>ChatGPT: "Predefinita" and "Serve la Codex CLI installata…";</li><li>name examples "es. Claude di lavoro" and "es. ChatGPT di lavoro".</li></ul> |
| Exit | PASS: the RealmNest process ends (its WebView2 processes too, checked on the dev build) |
| upgrade 0.11.0 → 0.11.2 (GUI), on a copy of the representative 0.11.0 profile (463 files) | PASS: <ul><li>no "already installed" page and no uninstaller;</li><li>installing about 9 s; finish page; Close; app started; version 0.11.2;</li><li>none of the profile's files were missing;</li><li>12 agents, the Claude and ChatGPT connections, the crew, the workflow, 2 schedules and the chats are all present.</li></ul> |
| upgrade 0.11.1 → 0.11.2 (GUI; dev build with the same upgrade change) | PASS: no "already installed" page, no uninstaller, data kept |
| owner's data | PASS: <ul><li>backup taken this morning (1,637 files, 169,738,410 bytes);</li><li>restored with **0 files differing** (SHA-256 per file);</li><li>RealmNest 0.11.2 started normally on it.</li></ul> |

Not verified on this release: Windows 10, a PC without WebView2 (where the installer downloads it), and the owner's laptop.

## Verdict

**READY FOR 0.11.2 PUBLIC BETA.**

**Next step for the owner:**

1. Push `release-staging/RealmNest-OS-0.11.2` (`main`).
2. Create release `v0.11.2` on GitHub.
3. Attach `RealmNest-OS_0.11.2_x64-setup.exe` and `SHA256SUMS.txt`.
4. Use `RELEASE_NOTES.md` as the description.
