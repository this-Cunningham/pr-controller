If you are consuming this CLAUDE.md from within the Claude Design web app, this is for you:

On startup, blanket-pull the latest base design system into `_ds/wabi-sabi-design-system-b6b92dd7-9602-4f5c-8ee1-731fe945db55/` to avoid drift — use `copy_files` from cross-project source `/projects/b6b92dd7-9602-4f5c-8ee1-731fe945db55/`. The project root isn't copyable directly, so copy each top-level item (files + folders) into the matching local path.

## Changelog — maintain `_changelog.json` (machine-readable sync contract)

This project is consumed downstream by the `/pull-new-designs` skill, which reads
`_changelog.json` to learn exactly what changed since its last sync. It is the single source of
truth for change history.

CRITICAL: On EVERY change — any edit to a file here, OR a base-design-system sync (the copy_files pull) —
append an entry and bump `latest`. Newest entry first. Shape:

{
  "schema": 1,
  "latest": <highest v>,
  "entries": [
    {
      "v": <int, +1 each entry>,
      "kind": "edit",          // a design change you made here
      "files": [
        { "path": "Header.dc.html", "op": "modified", "note": "<one sentence: what changed + intent>" }
      ]
    },
    { "v": <int>, "kind": "base-sync", "baseUpdatedAt": "<base DS project updatedAt at pull time>", "note": "pulled base DS — <what moved>" }
  ]
}

Rules:
- `latest` = the highest `v`; increment `v` by 1 per entry; never rewrite past entries.
- `kind:"edit"` → list each changed `path` with `op` (`added`|`modified`|`removed`) + a ONE-sentence `note`.
- `kind:"base-sync"` → the copy_files base-DS pull; do NOT enumerate `_ds/` files — one `note` + `baseUpdatedAt`.
- Keep notes VERY concise + factual; they drive the downstream reconciliation.

Important: These instructions are not for you if you are working downstream in a developer's repo.
