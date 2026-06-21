# Feedback: `/pull-new-designs` run — PR Controller prototypes (2026-06-20)

Running notes captured *while* executing the skill against
`~/Downloads/PR Controller prototypes`. Each entry = a snag hit or a concrete
suggestion for improving the skill. Ordered roughly by impact.

## Bottom line: fix the skill, not the repo

The repo's **app code is already correctly shaped** for the skill. The skill is
explicitly *role-based* ("Roles, not fixed paths… map each to its existing
convention"), and this repo cleanly satisfies all three roles:
`<DS>` = `components/{core,navigation,feedback}` + `tokens/`; `<FEATURE>` =
`components/pr/` (+ `App/adapt/controller`); `<BASELINE>` = the `design/.upstream/`
dir. Renaming the app's folders to the skill's *fallback* paths
(`src/design-system/`, `src/features/<name>/`) would be pure churn that breaks
imports/build for zero functional gain — the fallbacks only apply when **no**
convention exists.

The only thing genuinely misaligned was the **baseline layer**, because the old
`DESIGN_SYSTEM_SOURCE_OF_TRUTH/` was a *combined* foundation+prototype snapshot
(now superseded by the separated upstream). That's a small, targeted cleanup — not
an app restructure.

**Recommendation:** invest in making the skill flexible (it then works in *any*
repo, not just this one), and do a light baseline-layer normalization here. The
durable fixes are #1 (content/namespace baseline detection, subset-safe replace),
a persisted **`.design-sync.json`** mapping (project → baseline/DS/feature dirs),
#6 (consumer migration), and #7 (build/verify gate).

---

## 1. Baseline model breaks when an upstream project is *split* (HIGH)

The skill's mode detection is binary: "`<BASELINE>` absent → first-time, present
→ sync," with one baseline per project at `design/.upstream/<project>/`.

What this repo actually has:

- `DESIGN_SYSTEM_SOURCE_OF_TRUTH/` — the previously-integrated artifact. It is a
  **combined** export: the full Wabi-Sabi *foundation* (tokens + component `.jsx`
  + guidelines + ui_kits + a reference app) **and** a single
  `PR Controller.dc.html` product prototype.
- The new export (`PR Controller prototypes`) is **only the product workspace** —
  3 product DCs (`PR Controller`, `PRCard`, `ThreadRow`) **plus a _subset_** of the
  foundation under `_ds/wabi-sabi-design-system-…/` (only the tokens + bundled
  components those prototypes use).

So upstream **split one project into two** (a reusable foundation + a product
prototype workspace). Consequences the skill doesn't anticipate:

- There is **no baseline folder whose identity matches this export.** Folder-name
  matching (`design/.upstream/pr-controller-prototypes/`) finds nothing → the
  skill would call this a *first-time setup*, which is wrong: the app is already
  fully built.
- The closest baseline (`DESIGN_SYSTEM_SOURCE_OF_TRUTH/`) is a **superset** of the
  new export. Step "replace `<BASELINE>` with the full new export" would
  **destroy the foundation source of truth**, replacing it with a product subset.

**Suggestions:**
- Detect the baseline by **content / DS namespace match** (here:
  `DesignSystem_220c99`), not folder presence.
- Add an explicit rule: **never overwrite a richer baseline with a narrower
  (subset) export.** When the export is a subset, the baseline replacement must be
  scoped to the overlapping project, or a *new* baseline created for the split-off
  project — leaving the other intact.
- Persist a small **`.design-sync.json`** mapping each project (by namespace) →
  `{ baselineDir, dsDir, featureDir }`. Re-runs then resolve deterministically
  instead of re-guessing placeholders every time.

> Resolution taken this run: treated as a **sync** against
> `DESIGN_SYSTEM_SOURCE_OF_TRUTH/` as the base; created a **new, additive**
> baseline at `design/.upstream/pr-controller-prototypes/` for this product
> workspace; left `DESIGN_SYSTEM_SOURCE_OF_TRUTH/` untouched.

## 2. `<DS>` and `<FEATURE>` are interleaved in one tree (MEDIUM)

The placeholder table implies three separable roles. Here `<DS>` (primitives) and
`<FEATURE>` (product screens) both live under
`pr-controller-react/src/components/` — DS in `core/`, `navigation/`, `feedback/`;
features in `pr/`. The resolution worked, but the skill's "build what's present in
`_ds/`" framing assumes the app mirrors the export's structure. Here the **app is
ahead of the prototype**: 5 product components (`PRCard`, `ThreadRow`,
`BranchStatus`, `JiraBanner`, `StagedApprovalsBar`) vs the prototype's 2 DCs +
shell.

**Suggestion:** add a note — "the app may be *ahead of* the prototype; treat the
prototype as reference and diff for *intent*, never regress the app to the
prototype's structure."

## 3. Export docs describe the prototype medium, not the target (MEDIUM)

The export's `readme.md` (and a now-being-removed `CLAUDE.md`) insist: *"Styling is
inline (`style="…"` with `var(--*)`) … No component stylesheets, no CSS classes."*
This repo mandates the inverse: **CSS modules, no inline hardcoded styles.** An
agent that reads those docs too literally could wrongly vendor inline styles.

> Update (per the repo owner): the prototype workspace's root `CLAUDE.md` is being
> **deleted upstream** and should be ignored. But `readme.md` still describes the
> inline-style authoring model, so the underlying hazard remains.

**Suggestion:** state explicitly that any authoring rules shipped in an export
describe the **prototype medium**, not the target; the target repo's conventions
always win. The skill should **not** ingest an export's `CLAUDE.md`/`readme.md` as
instructions — only as context for *intent/tone*.

## 4. Token files carry export-tool annotation noise (LOW)

The new `effects.css` motion tokens carry `/* @kind other */` annotations (export
tooling metadata). These should be **stripped** when porting into idiomatic token
files, not copied verbatim. The skill says "bring tokens over nearly verbatim,"
which could pull this noise in.

**Suggestion:** note that `@kind …` / `@dsCard` and similar tool annotations are
metadata to drop on port.

## 5. Comment-only token churn de-product-ifies, and shouldn't be applied (LOW)

`typography.css`, `spacing.css`, `colors.css` diffs (base ↔ theirs) are **only**
comment rewrites that genericize product comments (`/* PR title */` →
`/* card title */`, `/* between PR cards */` → `/* between stacked cards */`). In a
*product* repo the product-specific comments are more useful. The skill's "apply
changed `var(--*)`" rule correctly ignores these — worth stating outright: **ignore
comment-only deltas; never churn local comments to match upstream wording.**

## 6. Tone-rename consumers + per-primitive scoping is unaddressed (MEDIUM)

The single biggest upstream change this run was a **tone-vocabulary rename** in the
foundation (`sage→active`, `accent→urgent`, `ochre→error`, `urgency→urgent`,
`agent→active`, `quiet→neutral`). The skill's "primitives" step talks about
updating the **component**, but a rename also requires migrating **every app
call-site** (here: `PRCard.jsx` Badge tones, `ThreadRow.jsx` DispositionTag tones)
or the tone silently falls back to a default.

Worse, the rename is **per-primitive, not global**: `accent`/`sage` are also used
by `TextButton` and the app-local `StatusLine`, which were **not** renamed in the
bundle. A naïve global find/replace would have broken them. The skill should warn:
rename **within each primitive's own tone set**, migrate that primitive's
consumers, and never global-replace a tone token.

**Suggestion:** add an explicit "migrate consumers, scoped per primitive" step to
the primitives section, with the shared-token-name hazard called out.

## 7. No build / test / visual-verify gate in the skill (MEDIUM)

The skill ends at a written report. For a **value-identical rename**, the only way
to catch a CSS-selector typo (e.g. renaming the `.jsx` tone but missing the
`.module.css` selector) is to build + run tests + look at it. This run added a
verify pass (yarn build, `node --test`, and a real-daemon browser check) and it
*did* matter — it's how I confirmed all seven renamed selectors resolve and that
`TextButton`/`StatusLine` were left intact.

**Suggestion:** make the final step "build + run the repo's tests + visually verify
the touched surfaces," not just "write the report."

## 8. Authoring a new primitive from the bundle is laborious (LOW)

`OrganicLoader` ships only as compiled JS in `_ds_bundle.js` (8 glyph variants,
inline styles, keyframes referenced from `tokens/base.css`). Re-authoring it as an
idiomatic CSS-module component meant hand-translating each glyph's inline styles
to module classes and lifting the per-index `animationDelay` to inline. Worked
well, but the skill could note the recipe: **keyframes → global `base.css`;
structural styles → module classes; only truly-dynamic values (delay, tone color,
size scale) stay inline.**

---

## Confirmed deltas + what was applied this run

A background analysis workflow (4 decoders + adversarial verifiers, 19 agents)
decoded all three prototypes and diffed them against the built app. Net result:
**12 verified actionable deltas.** Disposition:

**Applied (safe, in-scope, verified by build + 96 tests + browser):**
- **Motion tokens** — `+--ease-out / --ease-in-out / --ease-linear / --dur-slow`
  in `effects.css` (dropped the export's `@kind other` annotation noise).
- **base.css** — `+prefers-reduced-motion` contract and `+10 OrganicLoader
  keyframes`.
- **`OrganicLoader`** — new primitive (`.jsx`/`.module.css`/`.d.ts`, 8 variants),
  authored idiomatically. (Was the skill's "flag a gap" — now filled.)
- **`Skeleton`** — now leads with an ensō `OrganicLoader` (product caption kept).
- **Tone-vocabulary rename** across `Badge` / `DispositionTag` / `Callout` + their
  consumers (`PRCard`, `ThreadRow`). CSS values byte-identical → zero visual
  change (confirmed: live tags compute the right token colors).
- **Branch CTA copy** — out-of-sync now reads "Resolve in terminal" (vs "Open in
  terminal" for surfaced/conflict); the label now rides in the `adapt.js` action
  data so `PRCard` stays a pure renderer (tests updated to match).

**Surfaced for a decision → resolved with the user:**
- **Swimlanes view + view-switcher + modal-expand** — a genuinely *new* product
  feature in the export (the old "Components gallery" toggle was repurposed to
  "Dashboard ⇄ Swimlanes"). Large, and architecture-sensitive (must stay a pure
  filter/render of the daemon's placements per the repo invariant). **Decision:
  skipped in the app, kept in the design reference/baseline** (nothing removed) —
  available to build later from the prototype.
- **agent-working treatment** — export uses `Callout(active) + OrganicLoader
  (ripple)`; the app used a local `StatusLine` (pulsing dot). **Decision: adopted.**
  Added a small `AgentWorking` component (the export's "single home" for the
  live-agent semantic) used by both the agent-working row (`PRCard`) and the
  rebasing-conflict row (`BranchStatus`). `StatusLine` is now unused but left in
  place (don't delete shipped DS components). Verified live in the In-progress
  lane (ripple loader inside the active Callout).

**Deliberately skipped (app is better / no consumer):**
- `ScopeBadge` shortened default copy ("All" / "Scoped · N") and dropped tooltip —
  the app's verbose copy + the load-bearing "agent acts for real" tooltip are
  better; the new optional label props add API with no consumer.
- Comment-only token churn (de-product-ifying `typography/spacing/colors` comments).

## Baseline note

Created `design/.upstream/pr-controller-prototypes/` (additive) + a README mapping
each upstream project to its baseline + app destination. At the time of the run this
left `DESIGN_SYSTEM_SOURCE_OF_TRUTH/` in place — but see the follow-up below, which
superseded it.

---

## Update (follow-up) — structure aligned + skill updated

After the run, per the repo owner's direction (the old combined
`DESIGN_SYSTEM_SOURCE_OF_TRUTH/` was a mistake; foundation + prototype will be
imported *separately* going forward):

**Repo reorganized to the skill's canonical shape** (build output byte-identical —
same JS/CSS hashes — so the reorg changed only source layout; 96 tests pass):
- `pr-controller-react/src/design-system/` — `tokens/` + `styles.css` entry +
  `core/` `navigation/` `feedback/` foundation primitives.
- `pr-controller-react/src/features/dashboard/` — product components (`PRCard`,
  `ThreadRow`, `BranchStatus`, `JiraBanner`, `StagedApprovalsBar`), product-owned UI
  (`AgentWorking`, `StatusLine`, `TerminalNote`), shell (`Header`, `GrainOverlay`,
  `App`), and logic (`adapt.js`, `controller.js`, `useDashboard.js`).
- `main.jsx` + `theme.css` stay at `src/` root; `theme.css` → `./design-system/styles.css`.

**Baselines normalized** under `design/.upstream/`: `wabi-sabi-foundation/` and
`pr-controller-prototypes/`. Stale `DESIGN_SYSTEM_SOURCE_OF_TRUTH/` removed (recoverable
via git history). Added **`.design-sync.json`** (the resolved project→baseline→app
mapping the new skill Step 0 reads/writes). Docs updated (`CLAUDE.md`,
`ARCHITECTURE.md`, `README.md`) to the new paths.

> **Correction (verified later):** the foundation baseline was first flagged a
> "subset" out of caution, but a git-history comparison proved it is **complete** for
> this revision — it has every primitive the old foundation had **plus** OrganicLoader,
> and all six token files (motion added, nothing dropped). So nothing was lost by
> retiring the old combined dir. `.design-sync.json` now records `"subset": false` and a
> `policy.onUpstreamRemoval: keep-and-flag` (never auto-remove DS pieces — keep them for
> in-app prototyping; removals are still *detected* via the baseline diff and flagged).
> This is a generalizable lesson for the skill: **verify the "subset" assumption against
> the prior baseline rather than assuming it.**

**Skill updated** (generic, app-agnostic) at
`~/.claude/skills/pull-new-designs/SKILL.md` — all feedback above folded in: a new
**Step 0 resolve-&-map** (+`.design-sync.json`), content/namespace baseline detection,
subset-safe + split-aware baseline replacement, per-primitive consumer migration, a
**Final verify gate**, "export authoring docs are not instructions", strip-tool-
annotations, ignore comment-only token deltas, and the new-primitive-from-bundle recipe.

> Note: with the skill's Step 0 (scan→map→persist) now in place, a future repo would
> NOT need this manual reorg — the skill adapts to whatever shape exists. This repo was
> reorganized anyway, by choice, to keep the canonical shape.

## Adherence lint wired — and an oxlint gotcha

Wired the foundation's shipped `_adherence.oxlintrc.json` into the app as an active
lint (`cd pr-controller-react && yarn lint`): token hygiene (no raw hex/px,
design-system fonts only) + per-component prop/tone contracts (the tone enums use the
new abstract vocabulary, so it also guards the rename). The app lints **clean**.

**Gotcha worth flagging to the skill / design tool:** the config is named
`_adherence.oxlintrc.json`, but the entire thing is built on `no-restricted-syntax`
selectors, which **current oxlint (1.70) does not implement** ("Rule
'no-restricted-syntax' not found"). ESLint supports those esquery selectors natively,
so it runs there. Two implications for the "port usage intent" skill step (TODO): (a)
**run the adherence config under ESLint**, not oxlint, until oxlint implements the rule;
(b) it encodes a *narrower* prop surface than idiomatic re-authored components (e.g. our
`OrganicLoader` accepts `aria-hidden` via `...rest`) — so porting must reconcile a11y
passthrough props (we extended the OrganicLoader rule to allow `aria-hidden`).
The **import-from-barrel** rule was deferred (needs a `design-system/index.js` barrel).

---

# Run 2 — tiny prototype update (`PR Controller prototypes (1)`)

Dogfooding the trimmed, script-driven skill on a one-line upstream change. It went
smoothly — `detect-baseline` → SYNC, `git diff --no-index` instantly pinpointed the
**only** real change (PRCard's agent-working/conflict text gained
`color:var(--auto-fg)`), applied as one CSS-module class on the `AgentWorking` text span;
96 tests + build + DS-completeness + a visual check (text computes to `#9db18c` = sage)
all passed. The git-diff-for-the-delta simplification paid off — the whole reconcile was
a 2-line edit. Snags found:

## R2-1. `check-completeness --project <name>` breaks for a *product* sync (MEDIUM)

The verify gate says "run `check-completeness.mjs --project <name>`," but a **product**
project has no `tokens`/`primitives` in `.design-sync.json`, so the script errors:
`tokens dir not found: undefined`. Completeness is a **design-system** check (manifest ↔
vendored tokens/components) — for a product-only sync it must target the *design-system*
project (confirming the DS is intact), or be skipped when `_ds/` didn't change.

**Fix:** in the verify gate, say completeness runs against the **design-system** project;
and make the script degrade gracefully (if the project has no tokens dir, print
"no design-system layer for this project — skipping" and exit 0, instead of erroring).

## R2-2. "`scripts/…`" path is relative to the skill dir, not the repo (LOW)

The skill writes `scripts/detect-baseline.mjs`, but `scripts/` lives in the **skill's**
dir (`~/.claude/skills/pull-new-designs/scripts/`), while you run from the **repo root**
(for `.design-sync.json` / `design/.upstream/`). I invoked it as
`node ~/.claude/skills/pull-new-designs/scripts/detect-baseline.mjs …`. Worth one line:
"scripts live in the skill's own dir; run them from the repo root."

## R2-3. Diff carries non-app noise the skill doesn't name as ignorable (LOW)

`git diff --no-index` surfaced, besides the real change: `.thumbnail` (preview image),
the export's `CLAUDE.md` (deleted upstream), and a new `uploads/*.png` (a design sketch).
None are app-actionable. The skill says "ignore comment-only deltas" but doesn't name
these. **Fix:** add — ignore `.thumbnail`, the export's own `CLAUDE.md`/`readme.md`, and
`uploads/`-style design sketches in the diff; they're reference/runtime, not app code.
(Confirms the earlier call that the export's `CLAUDE.md` is going away upstream — it did.)

> **Refinement (resolved):** `.thumbnail` is a WebP preview tile and `uploads/` are design
> sketches — genuine binary noise. But "comment-only deltas" are NOT all noise: **usage-intent
> comments (component JSDoc, tone meanings, "reach for this" guidance) should be pulled** into
> the app's docs. The skill now distinguishes *cosmetic* comment churn (skip) from
> usage-intent comment/doc changes (pull), and no longer lists `CLAUDE.md`/`readme.md` as
> noise — they carry intent (handled in Anatomy).

---

# Run 3 — import from a `claude.ai/design` URL (DesignSync MCP)

Wired URL-based import into the skill. The `claude_design` MCP is the **`DesignSync`** tool.
Findings:

- **It reads non-design-system projects.** `DesignSync` is built for *design-system* pushes
  (its `list_projects` is filtered to writable design systems), but `get_project` /
  `list_files` / `get_file` work on a **product prototype** project by `projectId`
  (verified: `type: PROJECT_TYPE_PROJECT`). So the URL flow works for prototype spaces.
- **Same import as a manual download.** `list_files` returned the identical file set, and
  `get_file PRCard.dc.html` returned content byte-matching the download (including the
  `color:var(--auto-fg)` change), `truncated:false`. Differences vs a download are
  packaging-only: no zip; binaries (`.thumbnail`, `uploads/*.png`) come back via `get_file`
  with an `isBase64` flag. (Definitive proof available: pull all files → `git diff` vs the
  baseline = zero; skipped — it's a no-op delta now and ~15 calls.)
- **Poka-yoke (read-only).** A pull must never mutate the remote, so the skill restricts it to
  **only `list_files` + `get_file`** and explicitly forbids `finalize_plan`/`write_files`/
  `delete_files`/`register_assets`/`unregister_assets`/`create_project`.

**Snag — auth is out-of-band.** The first read needs design scopes via `/design-login`, but
that command **wasn't available in this environment** ("isn't available in this
environment"); access came through another path (subscription `/login`). The skill can't
self-authorize — it must tell the user, and the user authorizes out-of-band. The skill notes
this; worth keeping in mind that `/design-login` isn't universally runnable.

**Skill changes:** argument is now optional (local dir *or* `claude.ai/design/p/<uuid>` URL;
first run with no arg asks); `.design-sync.json` gains a per-project `projectId` so a no-arg
run can re-pull registered projects. Recorded this repo's prototype `projectId`
(`c011d797-…`) in its `.design-sync.json`.
