# Windows notifications

While RealmNest is in the background (minimized, or another window has the focus), two kinds of things show as a Windows notification under RealmNest's name and icon:

| kind | when |
| --- | --- |
| **approvals** | a tool call waits for your approval; a crew's plan or final result waits; a workflow's approval step waits; a deep research plan waits |
| **results** | an agent's task ends (done or failed); a crew, a workflow or a deep research ends (done or failed) |

A click on the notification brings the window back on what it was about: the crew run, the workflow run, the research, the agent's world. An approval prompt shows wherever you are.

Nothing is shown while you are looking at RealmNest. The steps of a bigger job are not announced one by one: a crew's or a workflow's tasks, delegated tasks and an agent's own research are covered by the job's own notification. The same notice twice within 10 seconds is shown once.

Settings › General › **Windows notifications**: on/off, and each kind on/off (all on by default), plus **Try a notification**. Stored under `notifications`. Windows' own settings (Do not disturb, the app's notification switch) still apply.

## Where it lives

| | |
| --- | --- |
| service | `src/runtime/notify/service.ts`: `DesktopNotifier` (bus events → notifications, settings), `TauriNotifyTransport` |
| native | `src-tauri/src/notify.rs`: the toast (WinRT `ToastNotificationManager`), command `notify_show` |
| UI | `NotifyCard` in `src/ui/screens/Settings.tsx` |
| tests | `src/tests/notify.test.ts`; `notify.rs` tests the toast XML and tags |

## Native side

- `notify_show(title, body, tag, backgroundOnly)` checks its input: control characters become spaces, the title is at most 100 characters (an empty one is refused), the body 300; both are XML-escaped. The tag is an id the page made (`crew:<run id>`, `tool:<call id>`…): letters, digits and `:._-`, at most 80.
- **In the background** is decided here, not in the page: with `backgroundOnly` the toast shows only when the main window is minimized, hidden or without the focus (a minimized WebView2 page still reports that it has the focus). **Try a notification** shows one regardless.
- The toast is shown with the app's `identifier` as AppUserModelID. The installer puts that id on the Start menu and desktop shortcuts, so Windows shows RealmNest's name and icon. A build without a shortcut still shows its toasts, under the bare id.
- A click (`Activated`) unminimizes, shows and focuses the main window, then emits `notification-clicked` with the tag. The last 20 toasts stay referenced, so their click handler is still there.
- It runs on a worker thread (WinRT), never the main thread. No new crate: `windows` 0.62 with `UI_Notifications`, `Data_Xml_Dom` and `Foundation`, already in the tree through Tauri.

## Limits

- Windows only. The browser build has no notifications and says so.
- A click on a notification after RealmNest was closed does nothing: there is no background activator.
- Telegram notifications are separate ([TELEGRAM.md](TELEGRAM.md)); both can be on.
