#!/usr/bin/env node
// Assemble the frontend the desktop shell loads.
//
// The desktop build is the web build minus the service worker. An SW inside a
// Tauri webview caches the app shell and makes "I rebuilt, why is it still the
// old UI?" very hard to diagnose, and it buys nothing: the shell is already
// local and always available.
//
// Dropping sw.js here means registerServiceWorker() in web/js/app.js fails and
// takes its existing catch branch, so the app falls back to the non-SW
// notification path. No JavaScript is modified to achieve this.

import { cp, rm, access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const source = new URL('../../dist-pwa/', import.meta.url);
const target = new URL('../../dist-desktop/', import.meta.url);

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', reject);
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`))));
  });

await run('npm', ['run', 'build', '--workspace', 'web']);

try {
  await access(source);
} catch {
  throw new Error('web build produced no dist-pwa/ output');
}

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });

// The one deliberate difference from the web build.
await rm(new URL('sw.js', target), { force: true });

// The app's canonical entry point is `/app` (see manifest.json's start_url). On
// the web that path exists only because a server rewrites it to index.html, or
// the service worker answers navigation for it. Offline neither applies: the
// webview resolves paths against files and there is no file called `app`, so
// `/app` 404s — in the shell and under any static server alike.
//
// A directory holding the same index.html gives the path a real file to resolve
// to. The copy needs one adjustment: Vite rewrites the bundle's own stylesheet
// and script references to root-absolute `/assets/...`, but leaves plain markup
// alone — `src="images/logo.png"` stays relative. At the root that resolves; from
// `/app` it becomes `/app/images/...` and 404s, which is how the logos shipped
// broken until a request log showed it. So markup references are made
// root-absolute for the copy, keeping the entry point self-consistent at any depth.
const appDir = new URL('app/', target);
await mkdir(appDir, { recursive: true });
const html = await readFile(new URL('index.html', target), 'utf8');
const rewritten = html.replace(
  /\b(src|href)="(?![/#]|[a-z][a-z0-9+.-]*:)([^"]*)"/gi,
  (_, attr, path) => `${attr}="/${path}"`
);
await writeFile(new URL('index.html', appDir), rewritten);

console.log('dist-desktop/ ready (sw.js excluded, /app entry point present)');
