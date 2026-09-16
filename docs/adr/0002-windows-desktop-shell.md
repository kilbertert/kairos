# Windows desktop shell: Tauri with pinned, irreversible identifiers

Kairos ships an optional Windows desktop shell built with Tauri 2 (a Rust host
around the system WebView2 runtime), distributed as an NSIS installer rather
than a portable executable. The portable form was rejected outright: Windows
attributes toast notifications by AppUserModelID, and an uninstalled executable
has none, so notifications would appear as PowerShell or not at all — which is
one of the reasons the shell exists.

Three values are pinned and documented as irreversible, because changing any of
them after a release silently orphans the user's local data (tasks, projects and
focus records live in IndexedDB, keyed by origin and profile):

- Bundle identifier `com.kilbertert.kairos`, which names the data directory
  under `%LOCALAPPDATA%`.
- `useHttpsScheme: false` on the main window, keeping the origin at
  `http://tauri.localhost`. `.localhost` is a trustworthy origin, so the APIs
  that require a secure context work regardless; switching to `https` would
  change the origin, and therefore the data profile, without changing the app's
  appearance.
- `bundle.targets: ["nsis"]`. The MSI target routes through WiX, which needs the
  optional Windows VBSCRIPT feature and adds a build failure mode for no gain.

The shell deliberately does **not** modify the web app. It is the web build with
the service worker omitted, which makes `registerServiceWorker()` take its
existing `catch` branch and the notification manager fall back to the non-service
-worker path. Avoiding a rewrite of the service-worker registration is what keeps
this change free of conflicts when merging `upstream/main`, which the project
does on demand.

## Consequences

- Not a native-rendered app: the interface is HTML rendered by WebView2. The
  shell provides native *capabilities* (tray, notifications, global shortcuts,
  autostart), not native *rendering*.
- The desktop app starts with empty data. Migration from the browser is a manual
  one-time import through the existing data-import feature; there is no sync.
