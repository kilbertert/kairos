const { defineConfig } = require('@playwright/test');

// Runs the desktop-only suite against dist-desktop/ — the exact bytes the
// Windows shell loads.
//
// It deliberately does NOT re-run tests/ against the desktop output. Those specs
// are written for the dev server: focus-ui.spec.js loads `/?dev=1`, a parameter
// web/js never reads, and most of its assertions are about layout and styling
// rather than about anything the shell changes. Re-running them off-build would
// test Chromium's rendering of a static page, which is neither what they exist to
// check nor what the shell affects. The application's behaviour is already
// covered by the web suite; this suite covers the shell's three differences.
//
// The one thing that must not be lost by narrowing: whether the app *starts* when
// the desktop shell serves it, since the shell's origin and entry points differ
// from the dev server's. shell.spec.js asserts exactly that, against `/app` —
// the app's canonical entry point and the one the shell actually loads.
//
// Port 12873, from the workspace's static pool (11000-14999) and clear of the
// kernel ephemeral range, so it cannot collide with an outbound connection. An
// arbitrary 4173 was tried first and silently attached to an unrelated process
// already listening there — `reuseExistingServer` does not distinguish "my
// server" from "someone else's", so the whole suite ran against a stranger.
// Playwright has no documented way to request a free port, so the number has to
// be chosen once and chosen safely.
//
// The static server is Python's stdlib — already a CI dependency for
// scripts/check-release.py — rather than another npm package.

module.exports = defineConfig({
  testDir: './desktop/tests',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:12873',
    headless: true,
    launchOptions: process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'python3 -m http.server 12873 --bind 127.0.0.1 --directory dist-desktop',
    url: 'http://127.0.0.1:12873',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
