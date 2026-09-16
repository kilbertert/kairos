# Kairos desktop shell

A Windows application that runs the Kairos web app in a native shell: taskbar
presence, a tray it lives in, system notifications, and global shortcuts.

It is not a rewrite. The shell loads the web build unchanged and adds
capabilities a browser tab cannot provide. Read
[../docs/adr/0002-windows-desktop-shell.md](../docs/adr/0002-windows-desktop-shell.md)
before changing anything here — several values in `tauri.conf.json` are
irreversible once released.

## What the shell adds

| Capability | Where |
|---|---|
| Tray icon; closing the window hides rather than quits | `src-tauri/src/main.rs` |
| `Ctrl+Alt+P` start/pause timer, `Ctrl+Alt+S` show/hide window | `src-tauri/src/main.rs` |
| Start with Windows (release builds only) | `src-tauri/src/main.rs` |
| One instance; a second launch focuses the first | `tauri-plugin-single-instance` |
| System notification when a focus session ends | `web/js/timer.js` → `web/js/notifications.js` |

The notification path is deliberately **not** shell-specific: the same call
serves the web build through the service worker and the desktop build through
`new Notification()`, because the shell excludes `sw.js`.

## Building

The Windows installer is built by `.github/workflows/desktop.yml` on
`windows-latest`, triggered by a `desktop-v*` tag or manually. Building on Linux
is not supported: Tauri's own documentation calls cross-compilation "a last
resort", and the MSI/NSIS toolchain is Windows-only.

Locally, the frontend half is checkable anywhere:

```bash
npm run desktop:dist    # assemble dist-desktop/ (the web build minus sw.js)
npm run test:desktop    # desktop suite against dist-desktop/
```

The Rust half — `cargo check`, `cargo build` — runs only in CI. That is a real
gap: a compile error surfaces there, not locally.

## How the desktop build differs from the web build

`desktop/scripts/build.mjs` produces `dist-desktop/`, which differs in exactly
two ways:

1. **`sw.js` is absent.** A service worker inside a webview caches the app shell
   and turns "I rebuilt, why is it still the old UI?" into a hard problem, and it
   buys nothing when the shell is already local. Removing the file makes
   `registerServiceWorker()` take its existing `catch` branch; no JavaScript is
   modified to achieve this.
2. **`app/index.html` exists.** The app's canonical entry point is `/app`, which
   on the web only exists because a server rewrites it or the service worker
   answers for it. Offline neither applies, so the entry point is given a real
   file — with its markup references made root-absolute, since Vite rewrites the
   bundle's own references but leaves `src="images/logo.png"` alone.

## The updater's signing key

Not yet configured; this is the next step, and it has one property that cannot
be undone.

Updating is authenticated by a public key in `tauri.conf.json` and a private key
held only in CI secrets (`TAURI_SIGNING_PRIVATE_KEY`). That keypair is
**permanent**: versions already installed will refuse an update signed by a
different key, so losing the private key means those installations can never be
updated again — only reinstalled by hand.

Before generating it, store a copy of the private key somewhere outside GitHub.
Generate once, back it up, and never regenerate it to "fix" an update failure.
