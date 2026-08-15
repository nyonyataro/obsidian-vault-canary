# Manual test plan

Japanese overview: [README.ja.md](../README.ja.md). Run the same scenarios with the plugin display language set to Japanese before each public release.

Use a disposable test vault only. Do not test deletion scenarios against the only copy of real notes.

## Desktop smoke test

1. Run `npm install` and `npm run build`.
2. Copy `main.js`, `manifest.json`, and `styles.css` to `.obsidian/plugins/vault-canary/` in the test vault.
3. Enable Vault Canary.
4. Open Settings → Vault Canary and confirm the settings tab renders without console errors.
5. Run **Set current vault state as baseline** and confirm a baseline notice appears.
6. Run **Check vault now** and confirm the no-shrink notice appears.

## File-count warning

1. Configure **Minimum file drop** to `3` and set percentage thresholds high enough not to matter.
2. Set the baseline.
3. Delete three disposable files.
4. After the debounce period, confirm an alert appears.
5. Confirm Settings still shows the pre-deletion baseline.
6. Restore the files and run **Check vault now**; confirm no shrink is reported.

## Warning state persistence

1. Configure **Minimum file drop** to `3` and set the baseline.
2. Delete three disposable files and confirm an alert appears.
3. Restore only one or two files and run **Check vault now**.
4. Confirm the original baseline is still retained and the notice says the smaller state is under review.
5. Restore all files or explicitly set a new baseline, then confirm the warning state clears.

## Markdown warning

1. Configure **Minimum Markdown drop** to `2`.
2. Set the baseline with at least two disposable Markdown notes.
3. Delete two notes.
4. Confirm the alert specifically mentions Markdown notes.

## Size warning

1. Add a disposable large attachment.
2. Set the baseline.
3. Configure **Storage size drop (%)** low enough to trigger when that attachment is removed.
4. Delete the attachment and confirm a storage-size warning.

## Modified-file warning

1. Add a disposable attachment large enough to make the size threshold meaningful.
2. Set the baseline.
3. Truncate or replace the attachment with a much smaller file without changing its path.
4. After the debounce period, confirm a storage-size warning appears.

## Excluded folders

1. Create `Ignored/` with several disposable files.
2. Add `Ignored` to **Excluded folders**.
3. Confirm the previous baseline is cleared.
4. Run **Check vault now** to create a new baseline.
5. Delete files inside `Ignored/` and confirm they do not affect the reported metrics.

## Startup grace

1. Set startup delay to at least 30 seconds and reload the plugin.
2. During the grace period, perform several create/delete operations in the disposable vault.
3. Confirm no automatic check fires before the configured delay.
4. Confirm a check occurs after the grace period.

## Mobile

1. Install the same build on Android or iOS in a disposable/synced test vault.
2. Confirm the plugin enables successfully (`isDesktopOnly: false`).
3. Confirm commands and settings work.
4. Confirm file deletion triggers a warning after the debounce period.
5. Confirm no network permission or external service is required.

## Release readiness

- `npm run check` passes in CI.
- Desktop smoke test passes.
- At least one Android or iOS smoke test passes.
- Release tag exactly matches `manifest.json` version and has no `v` prefix.
- Draft release contains `main.js`, `manifest.json`, and `styles.css`.
- README accurately describes current behavior and limitations.
- After publication, the [Community Plugins listing](https://community.obsidian.md/plugins/vault-canary) shows the expected version and description.
