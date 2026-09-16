# The desktop app is versioned separately from the web app

Kairos ships two products from one repository, and they are versioned
independently. The web app is `2.0.0` in `package.json` and tagged `v*`. The
desktop shell starts at `1.0.0` and is tagged `desktop-v*`.

Tying them together was the obvious alternative and was rejected: most desktop
releases exist to fix a shell concern — tray behaviour, a shortcut conflict, an
updater issue — and would otherwise force a new web release, while most web
releases (a stylesheet, a copy change) do not warrant shipping an installer at
all. Independent lines let each move when it has a reason to.

The consequence is that the version is *not* a single repository-wide value, so
the invariant worth enforcing is narrower than "one version everywhere": the
desktop version appears twice — `version` in the Tauri config and `version` in
`desktop/src-tauri/Cargo.toml` — and those two must agree. CI checks that pair
and fails the build when they drift. It deliberately does not compare either
against `package.json`, because those are different products.

`package.json` still carries the `zhtyyx/kairos` repository URL. That is
upstream, this repository is a fork of it, and the field is correct as it stands.
