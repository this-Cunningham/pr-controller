# `design/.upstream/` — Claude Design sync baselines

Committed mirrors of the **last integrated** Claude Design export for each upstream
project. **Reference only — the app never imports anything here.** They exist so the
next `/pull-new-designs` run can tell *upstream changes* apart from *local edits* (a
3-way merge base, like a lockfile). The resolved project→baseline→app mapping lives
in [`../../.design-sync.json`](../../.design-sync.json).

## Projects → baselines (and where they land in the app)

| Upstream project | Baseline here | App destination |
| --- | --- | --- |
| **Wabi-Sabi foundation** (namespace `DesignSystem_220c99`) | `wabi-sabi-foundation/` | tokens → `pr-controller-react/src/design-system/tokens/`; primitives → `pr-controller-react/src/design-system/{core,navigation,feedback}/` |
| **PR Controller prototypes** (product workspace) | `pr-controller-prototypes/` | `pr-controller-react/src/features/dashboard/` |

> **Two baselines, by design:** upstream separates the reusable *foundation* from the
> *product prototype workspace*. They are synced independently into their own app
> destinations; pulling one never touches the other. (The old combined
> `DESIGN_SYSTEM_SOURCE_OF_TRUTH/` was retired; it remains in git history, including its
> reference `guidelines/`/`ui_kits/` and font binaries, which are docs/specimens, not DS
> tokens or primitives.)

## Updating

After a clean `/pull-new-designs` apply, the matching baseline folder is replaced
wholesale with the new export, so the next run diffs against current state.
