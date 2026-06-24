# Design system — usage guide

The Wabi-Sabi design system, vendored into this repo as idiomatic React. A quiet,
paper-ink aesthetic: beauty in imperfection and restraint. In UI terms that means a
**paper/ink palette at low chroma**, **hairline borders instead of shadows**, **generous
negative space**, a faint **paper grain**, and a single restrained **persimmon "seal"
accent** used only where attention is genuinely required.

This is the in-app usage guide — distilled from the upstream design system's authoring
notes and adapted to how the primitives actually ship *here*. It is the companion to the
adherence lint (`pr-controller-react/eslint.config.js`), which mechanically enforces the
token-hygiene and per-component prop/tone rules described below.

> This file documents *usage intent* (which primitive to reach for, which tone means
> what). It is NOT the routing layer. Components render; they never decide which lane an
> item belongs to — that lives in the daemon (`placements.mjs`). See the repo `CLAUDE.md`.

## How it's built here

- **Tokens** live in `src/design-system/tokens/` (`colors.css`, `typography.css`,
  `spacing.css`, `effects.css`, `fonts.css`, `base.css`) and load once at the app root via
  `styles.css`. The whole app references the `var(--*)` names — those names are the
  contract. Never inline a raw value.
- **Primitives** are real React components grouped under `core/`, `feedback/`, and
  `navigation/`. Each is a `<Name>.jsx` + `<Name>.module.css` + `<Name>.d.ts`.
- **Styling convention is CSS modules.** Components carry no inline hardcoded styles — every
  color/size/font is a `var(--*)` token applied through a `.module.css` class. The only
  inline `style` values are truly dynamic (per-index animation delays, a `size` scale, a
  tone-color override by token name). This is deliberately *different* from the upstream
  prototype medium, which authors styles inline; here the repo's CSS-module convention wins.

## Token hygiene (the lint enforces these)

- **No raw hex colors.** Use a color token via `var(--*)` (e.g. `var(--accent)`,
  `var(--ink-2)`), never `#C97A5F`.
- **No raw `px` values.** Use a spacing/radius token (`var(--space-3)`, `var(--radius-card)`).
- **Fonts are the three the system ships:** `Newsreader` (serif — wordmark/display only),
  `Hanken Grotesk` (sans — all UI and body), `IBM Plex Mono` (mono — every code identifier,
  count, path, key, eyebrow, and tag). No other `font-family`.

## Semantic tones — one abstract vocabulary

Every primitive names its tones from the same small set; pick by **meaning**, not by the
color it happens to render. The same name means the same thing everywhere — so pass the
abstract tone name (`urgent`), never a product color.

| tone | token | meaning |
| --- | --- | --- |
| `urgent` | `--accent` | needs attention — the only attention-drawing tint, kept rare (the seal) |
| `active` | `--auto-*` (sage) | in progress / positive |
| `neutral` | `--surface-2` / `--ink-2` | quiet / informational / waiting |
| `pending` | `--pending-*` | not yet classified — a dashed, unfilled chip, fainter than `neutral` |
| `praise` | `--praise-*` | positive feedback |
| `error` | `--err-*` (ochre) | error — calm, not alarming |

Plus one structural treatment, `outline` (transparent fill, hairline border) for
de-emphasized / draft states.

Not every primitive accepts every tone — each declares only the ones it needs, and the lint
holds you to that exact set:

- **Badge** — `neutral | active | urgent | praise | outline`
- **DispositionTag** — `urgent | active | neutral | praise | error | pending`
- **Callout** — `urgent | active | neutral`
- **TextButton** — `accent | muted`
- **OrganicLoader** `tone` is a *raw token override* (`ink-2 | auto-fg | accent`), not a
  semantic name — each variant already carries the right default color; only override when
  the surrounding context demands it.

> **Urgency is a budget, not a palette.** `urgent`/accent (the seal), a `pulse`, and an
> `emphasize`d count all draw the eye. Use at most one per view, or they stop meaning
> "look here." In this app the seal/accent rule is the **Needs-you** treatment only — the
> same PR is calm in every other lane.

## Which primitive to reach for

Pick by the job, not the look — several primitives share tints, so the unit and context
decide.

**Actions** (`core/`)
- **Button** — a discrete action with weight: `variant="primary"` for the one decisive
  action, `outline` for secondary, `ghost` for low-stakes / dismiss.
- **TextButton** — a quiet inline affordance inside dense copy or rows (Undo, Show more,
  Show reasoning). Anything decisive should be a Button.
- **Toggle** — a binary on/off switch for a single, **immediate self-applying** setting
  (sage track when on; `disabled` renders a dashed, locked track). Controlled (`checked` +
  `onChange`) or uncontrolled (`defaultChecked`); pass `label` for the switch-plus-text row.
  For a choice the user must confirm, use a Button pair instead — one toggle = one setting.

**State & labels** (`core/`)
- **Badge** — an object's overall state or a small signal pill (`mono` for tracked status
  like review state; plain for inline signals like "behind base"). `outline` is the
  draft / de-emphasized treatment.
- **DispositionTag** — a row-level disposition as an uppercase tracked mono chip; `pending`
  (dashed) for not-yet-judged. Rule of thumb: **Badge = the object, DispositionTag = the
  row.**

**Status surfaces** (`core/` + `feedback/`)
- **Callout** — the workhorse ambient-status box (left rule + optional dot): `urgent` /
  `active` / `neutral`, `pulse` only for live states. For anything longer than a status
  line, it's the wrong tool.
- **OrganicLoader** (`feedback/`) — a waiting / pending beat. Eight quiet glyphs
  (`enso | ripple | seal | brush | motes | reeds | kintsugi | stones`); pick a `variant`
  by meaning, show **one on screen at a time**, never racing.
- **Skeleton** (`feedback/`) — first-load placeholder before content exists (it already
  embeds a neutral loader). Use OrganicLoader directly for in-place waits once content is
  present.

**Acknowledgment** (`feedback/`)
- **Toast** — a transient, global "it happened" (bottom-center, one at a time). Not for
  anything needing a decision.
- **Confirmation** — an inline acknowledgment that stays put, often replacing an item's
  controls; offer `onUndo` for reversible actions.
- **EmptyState** — a calm "nothing here" (the open ensō), never an error.

**Navigation & framing** (`navigation/`)
- **Tabs** — switch between sibling views; `emphasize` at most one count.
- **ScopeBadge** — toggle a view between everything and a filtered subset.
- **ThemeSwitcher** (`core/`) — swap among the six themes at runtime.

## Visual foundations (quick reference)

- **Cards** — `background: var(--surface)`, a single hairline (`1px var(--line)`),
  `border-radius: var(--radius-card)`, no shadow. An urgent card adds a 3px `--accent` rule
  down the left edge and a small seal dot at top-right — the only emphasis treatment.
- **Borders** — hairlines do the structural work: `--line` for dividers and card edges,
  `--line-2` for stronger borders (inputs, draft chip). Separate rows with a top hairline,
  not spacing alone.
- **Shadows** — almost none; depth is tonal. Only the toast and the active segmented item
  carry a shadow.
- **Motion** — minimal, soft, and fully tokenized (`tokens/effects.css`); nothing springs.
  Easings by job: `--ease` (one-shot UI), `--ease-out` (entrances), `--ease-in-out` (symmetric
  loops — pulse/breathe/shimmer), `--ease-linear` (rotation). Durations: `--dur-fast` (.28s,
  fades), `--dur-card` (.3s, entrances), `--dur-slow` (.6s — the ceiling for any UI transition),
  `--pulse` (1.6s, the live-dot period). One-shot keyframes ship globally in `tokens/base.css`
  (`ws-appear` cards/confirmations, `ws-fadeup` toast, `ws-shimmer` skeletons, `ws-spin` while
  refreshing); the ambient working/pending vocabulary is the **OrganicLoader** (show one, never
  racing). A `prefers-reduced-motion: reduce` block collapses it all to near-instant — every
  component's end-state is its base style. **Reach for motion only when an element arrives,
  leaves, or is live**, and pick the token by its job, not its number; anything longer than
  `--dur-slow` is ambient, not a transition — use OrganicLoader.
- **Iconography** — no icon font. A tiny vocabulary of Unicode glyphs in the type
  (`⟳` refresh, `↳` annotation, `◆` marker, `✓` done) plus CSS shapes for status (a filled
  `--accent` dot = urgent, a sage dot = active, an open ensō = empty). No emoji.

## Theming

Six themes — `warm`, `stone`, `tea` × `light`, `dark` — defined as `[data-theme]` blocks in
`tokens/colors.css`; `:root` defaults to `stone-dark`. Switch live by setting
`document.documentElement.dataset.theme` (the **ThemeSwitcher** does exactly this), and
every token retints.

---

This system is **frozen** and synced only via `/pull-new-designs` (see `.design-sync.json`).
Don't restyle primitives ad hoc or edit them by hand. When upstream changes, run the sync
skill; it re-authors the primitives and migrates call-sites for you.
