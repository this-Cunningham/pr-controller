# `design/.upstream/` — Claude Design sync baselines

Committed mirrors of the **last integrated** Claude Design export for each upstream
project. **Reference only — the app never imports anything here.** They exist so the
next `/pull-new-designs` run can tell *upstream changes* apart from *local edits* (a
3-way merge base, like a lockfile). The resolved project→baseline→app mapping lives
in [`../../.design-sync.json`](../../.design-sync.json).

## Projects → baselines (and where they land in the app)

| Upstream project | Baseline here | App destination |
| --- | --- | --- |
| **Wabi-Sabi foundation** (namespace `DesignSystem_220c99`) | *(bundled in the product export's `_ds/` — no standalone baseline yet)* | tokens → `pr-controller-react/src/design-system/tokens/`; primitives → `pr-controller-react/src/design-system/{core,navigation,feedback}/` |
| **PR Controller prototypes** (product workspace) | `pr-controller-prototypes/` | `pr-controller-react/src/features/dashboard/` |

> **One export today, two projects.** The foundation and the product are distinct upstream
> projects, but right now only the *product* is exported — and it bundles the full foundation
> in its `_ds/`. So there's a single baseline (`pr-controller-prototypes/`), and the
> foundation's reference IS that export's bundled `_ds/`. **Don't copy the bundled `_ds/` into
> a separate foundation baseline** — it duplicates the design system and drifts on the next
> product sync. A *standalone* foundation import would give the foundation its own
> `wabi-sabi-foundation/` baseline. (The old combined `DESIGN_SYSTEM_SOURCE_OF_TRUTH/` was
> retired; it remains in git history.)

## Updating

After a clean `/pull-new-designs` apply, the matching baseline folder is replaced
wholesale with the new export, so the next run diffs against current state.
