# Design notes

## Goal

Detect sudden, suspicious shrinkage in an Obsidian vault without requiring Git, a cloud service, or a custom storage format.

## Baseline model

Vault Canary stores aggregate metrics only: visible file count, Markdown note count, total visible bytes, and a timestamp.

Normal checks roll the baseline forward when no threshold is crossed. If a shrink crosses a configured threshold, the previous baseline is retained until the user explicitly accepts the current state or files are restored.

## Why three signals

- **All files** catches broad deletion events.
- **Markdown notes** catches note loss that can be hidden by a large attachment collection.
- **Total bytes** catches loss of large attachments even when the file count barely changes.

## False-alarm controls

- startup grace after `workspace.onLayoutReady()`
- event debounce for create/delete/rename bursts
- alert cooldown for unresolved shrinkage
- percentage thresholds are disabled for very small baselines
- excluded-folder changes invalidate the old baseline before another comparison

## Scope and privacy

The plugin uses only Obsidian's public Vault API and plugin data storage. It does not read note contents, make network requests, or modify notes.

## Known MVP trade-off

Because a non-alerting shrink becomes the next rolling baseline, very gradual losses that stay below every threshold may not trigger. This keeps normal small deletions from accumulating into a false alarm. A future version could offer an optional long-term high-water baseline in addition to the rolling baseline.
