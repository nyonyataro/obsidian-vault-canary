# Vault Canary

[日本語のREADME](README.ja.md)

Vault Canary is a small, local-first Obsidian plugin that warns when the visible contents of your vault unexpectedly shrink.

Vault Canary requires Obsidian 1.13.0 or later.

The settings, notices, and command names follow Obsidian's Japanese interface by default. You can also force Japanese or English from the plugin settings.

It is meant to catch the kind of problem that can otherwise stay unnoticed for hours or days: a sync mistake, a broken automation, or another tool deleting a large set of files.

> Vault Canary is an early-warning signal, not a backup. Keep a separate backup or version history so you can recover files after an alert.

## What it watches

Vault Canary keeps a lightweight baseline containing only aggregate metrics:

- total visible file count
- Markdown note count
- total size of visible vault files

It then checks the current vault after startup, periodically, and shortly after file create, delete, rename, or modify events.

By default it warns when any of these happen:

- at least 50 visible files disappear
- visible file count falls by at least 10% (for baselines of 100+ files)
- at least 20 Markdown notes disappear
- Markdown note count falls by at least 10% (for baselines of 50+ notes)
- total visible vault size falls by at least 20%

All thresholds are configurable.

## Safety behavior

A warning does **not** automatically replace the saved baseline with the smaller state. This is intentional: an accidental deletion should not silently become the new normal. After a warning, the baseline remains until the aggregate metrics recover to at least the previous baseline or you explicitly set a new baseline.

After you review sync or backups, use **Set current vault state as baseline** only if the shrink was expected.

Other safeguards:

- automatic monitoring waits 60 seconds after the workspace is ready by default
- rapid file events are debounced before a check
- repeated automatic warnings use a cooldown
- changing excluded folders clears the old baseline so different scopes are not compared
- the plugin never modifies note content
- the plugin makes no network requests and has no telemetry

## Commands

- **Check vault now** — compare the current vault to the baseline immediately
- **Set current vault state as baseline** — accept the current aggregate metrics as normal

## Excluded folders

You can exclude vault-relative folders in Settings → Vault Canary, one folder per line. For example:

```text
Archive
Generated/cache
```

The folder itself and all descendants are ignored.

## What "visible vault" means

Vault Canary uses Obsidian's public Vault API. It therefore monitors files that Obsidian exposes through that API. Hidden/configuration folders such as `.obsidian` are not part of the monitored file set.

## Privacy

Vault Canary runs locally. It stores only settings, the aggregate baseline, the unresolved-shrink state, and the last alert time in the plugin's normal data file. It does not read note contents, upload data, or use analytics.

## Installation

### Community Plugins

Vault Canary is available in the official Community Plugins directory:

[Vault Canary in Community Plugins](https://community.obsidian.md/plugins/vault-canary)

1. Open **Settings → Community plugins**.
2. Select **Browse** and search for `Vault Canary`.
3. Install the plugin and enable it.

### Pre-release / development install

For unreleased builds, you can use BRAT with this repository:

```text
https://github.com/nyonyataro/obsidian-vault-canary
```

### Manual development install

1. Clone this repository.
2. Run `npm install`.
3. Run `npm run build`.
4. Copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/vault-canary/` in a test vault.
5. Enable **Vault Canary** under Community plugins.

Do not develop or test destructive scenarios against your only copy of a real vault.

## Development

```bash
npm install
npm run check
```

`npm run check` runs linting, unit tests for detection logic, TypeScript checking, and a production build.

Production `main.js` is generated during builds and release workflows; it is intentionally not committed to the source repository.

## Releases

Stable releases are distributed through Community Plugins. Release tags use plain semantic versions such as `0.1.0` without a `v` prefix. A matching tag creates a draft GitHub release with `main.js`, `manifest.json`, and `styles.css` attached; after maintainer review, the release is published and the Community Plugins listing is checked.

## Support

If Vault Canary helps protect your notes, you can optionally [support development with a coffee](https://buymeacoffee.com/nyonyataro) ☕. Donations do not unlock additional features.

Please report reproducible issues on GitHub without attaching private vault contents.

## License

MIT
