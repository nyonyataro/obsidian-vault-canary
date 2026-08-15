# Design notes

## Goal

Detect sudden, suspicious shrinkage in an Obsidian vault without requiring Git, a cloud service, or a custom storage format.

## Baseline model

Vault Canary stores aggregate metrics only: visible file count, Markdown note count, total visible bytes, and a timestamp. It also stores whether an alerting shrink is still under review.

Normal checks roll the baseline forward when no threshold is crossed. If a shrink crosses a configured threshold, the previous baseline is retained until the aggregate metrics recover to at least that baseline or the user explicitly accepts the current state.

## Why three signals

- **All files** catches broad deletion events.
- **Markdown notes** catches note loss that can be hidden by a large attachment collection.
- **Total bytes** catches loss of large attachments even when the file count barely changes.

## False-alarm controls

- startup grace after `workspace.onLayoutReady()`
- event debounce for create/delete/rename/modify bursts
- alert cooldown for unresolved shrinkage
- percentage thresholds are disabled for very small baselines
- excluded-folder changes invalidate the old baseline before another comparison

## Scope and privacy

The plugin uses only Obsidian's public Vault API and plugin data storage. It does not read note contents, make network requests, or modify notes.

## Localization

User-facing settings, commands, and notices are kept in English and Japanese dictionaries. The plugin follows Obsidian's current interface language through the public `getLanguage()` API by default, with an explicit language override in settings. The manifest name and description remain English for Community Plugins metadata compatibility.

## Release safety

Version metadata is synchronized by the npm `version` lifecycle. The release workflow accepts only `x.y.z` tags, verifies the package/manifest/version mapping, runs the full check suite, checks the release assets and size budget, attaches build provenance, and creates a draft release. Publishing the draft and confirming that the Community Plugins listing reflects the published release remain manual maintainer decisions. The initial `0.1.0` release is published and listed.

## Known MVP trade-off

Because a non-alerting shrink becomes the next rolling baseline, very gradual losses that stay below every threshold may not trigger. This keeps normal small deletions from accumulating into a false alarm. A future version could offer an optional long-term high-water baseline in addition to the rolling baseline.
