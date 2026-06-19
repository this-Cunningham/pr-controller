# Design system (vendored)

This is the **Wabi-Sabi design system, vendored into the app** so the dashboard is
self-contained — tokens, resets, keyframes, and the shared UI components all live
here and are imported with normal relative paths (no cross-repo/cross-directory
alias).

**Canonical source:** `../../../design-system/` (the repo's design-system skill).
That directory is the source of truth and is never removed. When it changes, sync
the runtime files here (`tokens/*.css`, `styles.css`, `components/**/*.jsx`).

## What's here

- `styles.css` — global entry; `@import`s the tokens + webfonts. Linked once via
  `src/theme.css`.
- `tokens/` — colors (six themes), typography, spacing, effects, fonts, base
  (resets + `ws-*` keyframes).
- `components/`
  - `core/` — Button, Badge, DispositionTag
  - `feedback/` — Toast, Confirmation, EmptyState, Skeleton, TerminalNote
  - `navigation/` — Tabs, ModeBadge

The product compositions (PRCard, ThreadRow, JiraBanner, Header) live in
`../components/` and are built ON these primitives — they carry the app's real,
backend-wired behavior, which is richer than the design system's reference
compositions.
