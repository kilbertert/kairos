# QA plan — Kairos Windows desktop shell

Two execution environments, because they cover different halves:

- **Automated (CI, headless Chromium)** — covers the application and the assembled
  build. Run by `npm run test:desktop`.
- **Manual (Windows)** — covers the shell capabilities. A headless browser cannot
  observe a tray icon, a toast's attribution, or `RegisterHotKey` behaviour, and
  a test that claimed to would be a test of the mock, not the system.

Cases are listed in execution order. A case that is blocked must be reported as
blocked with the reason, never as passed.

---

## Part 1 — Automated

Environment: CI `ubuntu-latest`, Node 22, Chromium via Playwright.
Build identity: the commit under test; results attached to the workflow run.

| ID | Preconditions | Actions | Expected observable result |
|---|---|---|---|
| A1 | `npm ci` run | `npm run desktop:dist` | Exits 0; `dist-desktop/` exists and contains `index.html` |
| A2 | A1 | `test ! -e dist-desktop/sw.js` | Exits 0 — the service worker is absent |
| A3 | A1 | Inspect `dist-desktop/` for every path in `dist-pwa/` except `sw.js` | No file missing |
| A4 | A1 | `npm run test:desktop` | All tests pass, including the pre-existing suite re-run against `dist-desktop/` |
| A5 | A1 | In the running app, evaluate `navigator.serviceWorker.controller` | `null` |
| A6 | A1 | In the running app, evaluate `navigator.serviceWorker.getRegistrations()` | Empty |
| A7 | A1 | Record every request whose path is `/sw.js` while the app starts | Zero requests |
| A8 | A1 | Create a project and a task, reload the page | Both still visible |
| A9 | A1 | Record every request host while the app is used | Only `127.0.0.1` |

Coverage note: existing `tests/local-storage.spec.js` already asserts "no remote
requests" and "data survives reload" for the web build; A8 and A9 re-run them
against the desktop output. `tests/desktop/shell.spec.js` adds A5–A7, which are
the desktop-specific difference.

---

## Part 2 — Manual (Windows)

Environment: a Windows 11 machine, the NSIS installer built by the `Desktop`
workflow for the commit under test. Record the OS build and the installer's
commit SHA with the results.

| ID | Preconditions | Actions | Expected observable result | Cleanup |
|---|---|---|---|---|
| M1 | Installer downloaded | Run it | Installs with no administrator prompt; a shortcut appears | — |
| M2 | M1 | Launch from the Start menu | Window opens; taskbar shows the Kairos icon (not a generic one) | — |
| M3 | M2 | Close the window with the X button | Window hides; the tray icon remains; the process is still in Task Manager | — |
| M4 | M3 | Click the tray icon | Window returns and is focused | — |
| M5 | M2 | Right-click the tray icon | A menu with 显示窗口 / 退出 appears | — |
| M6 | M5 | Choose 退出 | Process exits; the tray icon disappears | — |
| M7 | M2 | Settings → set 专注时长 to 1 minute | Setting accepts 1 | Restore to 25 |
| M8 | M7, notifications not yet granted | Focus → 开始专注, wait for the session to end | A permission prompt appears; the completion is still announced in-app (modal, sound, title flash) | — |
| M9 | M8, permission granted | Start another 1-minute session, wait for it to end | A **Windows toast** appears. **Attribution check:** the toast names *Kairos*, not PowerShell, and shows the Kairos icon | — |
| M10 | M9 | Click the toast | The Kairos window comes to the foreground | — |
| M11 | M9 | Enable Focus Assist / 专注助手 | The toast is suppressed by Windows and appears in the notification centre afterwards | — |
| M12 | M2 | With Kairos in the background, press the start/pause shortcut | The timer starts or pauses | — |
| M13 | M12 | Assign the same shortcut to another running application, restart Kairos | Kairos starts; the conflict is reported in the log; other shortcuts still work | Release the shortcut in the other app |
| M14 | M1 | Reboot | Kairos starts automatically (or is absent from startup if autostart was disabled) | — |
| M15 | M1, existing data | Install a newer build over the old one | Projects, tasks and focus records are unchanged after the update | — |
| M16 | M1 | Uninstall via 设置 → 应用 | Removes the app and its Start-menu entry | Delete `%LOCALAPPDATA%\com.kilbertert.kairos` to reset state |

### Notes for the runner

- M9 is the decisive case. It answers the probe question P2 exists to answer: does
  an installed Tauri app's `new Notification()` produce a correctly attributed
  Windows toast? If it does not, the finding is recorded and the notification path
  moves to `tauri-plugin-notification`; do not mark the case passed.
- M3 asserts the process survives the window close. If the process exits, the tray
  lifetime is misconfigured — check `CloseRequested` handling first.
- M13 requires deliberately creating the conflict; the shortcut is system-wide and
  first-come-first-served. Expect `ERROR_HOTKEY_ALREADY_REGISTERED` in the log.
- Data lives in `%LOCALAPPDATA%\com.kilbertert.kairos`. Deleting it resets the app
  to empty, which is also how M16 cleanup and any "fresh install" re-test works.
