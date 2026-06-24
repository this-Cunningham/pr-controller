# Wabi-Sabi Design System

A quiet, paper-ink design system: beauty in imperfection, transience, and natural simplicity. Uncluttered space, raw muted materials, and an appreciation for the worn and quiet. In UI terms that means a **paper/ink palette at low chroma**, **hairline borders instead of shadows**, **generous negative space** (*ma*), a faint **paper grain**, and a single restrained **persimmon "seal" accent** used only where attention is genuinely required.

It ships a token layer (six warm/stone/tea × light/dark themes), a small set of UI primitives, and a deliberately tiny iconography. Nothing here is tied to a product domain — every token and component speaks one abstract tone vocabulary.

## Using the system

Link the single entry point and use the CSS custom properties:

```html
<link rel="stylesheet" href="styles.css" />
```

`styles.css` `@import`s the tokens (`tokens/*.css`), webfonts, and base resets/keyframes. Components are React and reference the tokens via inline styles — never hard-coded colors.

---

## VISUAL FOUNDATIONS

**Palette.** Muted and low-chroma throughout. The shipped default theme is **stone · dark** (charcoal grey-green ground, soft off-white ink). Surfaces step `--bg #1E211F` → `--surface #262A27` → `--surface-2 #2F3431`; ink steps `--ink #E4E7E1` → `--ink-2 #A2A89E` → `--ink-3 #6E746C`. The one accent is a warm persimmon **seal** `--accent #C97A5F`, reserved for urgency (the left rule + seal dot, attention pills, the scoped-badge ring). Muted semantic tints: **sage** (`--auto-*`, active/positive), **praise** (`--praise-*`), **ochre** (`--err-*`, error — calm, not alarming).

**Semantic tones — one abstract vocabulary.** Every primitive names its tones from the same six-value set; pick by meaning, and the same name means the same thing everywhere:

| tone | token | meaning |
| --- | --- | --- |
| `urgent` | `--accent` | needs attention — the only attention-drawing tint, kept rare (the seal) |
| `active` | `--auto-*` (sage) | in progress / positive |
| `neutral` | `--surface-2` / `--ink-2` | quiet / informational / waiting |
| `pending` | `--pending-*` | not yet classified — a dashed, unfilled chip, fainter than `neutral` |
| `praise` | `--praise-*` | positive feedback |
| `error` | `--err-*` (ochre) | error — calm, not alarming |

Plus one structural treatment, `outline` (transparent fill, `--line-2` hairline), for de-emphasized / draft states on **Badge**. `Callout` uses only the three tones it needs: `urgent` / `active` / `neutral`. **OrganicLoader**'s `tone` prop is a raw color override by token name (`ink-2` / `auto-fg` / `accent`) rather than a semantic name, because it overrides the glyph color directly — each variant already carries the right default.

The system is built across **six themes** — `warm`, `stone`, `tea` × `light`, `dark`. Switch the `:root` block (or set `data-theme` at runtime) to retheme. Full values:

| token | warm·light | warm·dark | stone·light | stone·dark | tea·light | tea·dark |
| --- | --- | --- | --- | --- | --- | --- |
| --bg | #F2EDE3 | #211D17 | #EAEDE9 | **#1E211F** | #EEE8DA | #20190F |
| --surface | #FBF8F1 | #2A2620 | #F5F7F3 | **#262A27** | #F8F3E8 | #292318 |
| --surface-2 | #F0E9DC | #332E26 | #E7ECE6 | **#2F3431** | #ECE4D3 | #322B1E |
| --ink | #2C2823 | #ECE5D8 | #272A27 | **#E4E7E1** | #2A241C | #ECE3D2 |
| --ink-2 | #6C6457 | #ABA290 | #5D635B | **#A2A89E** | #6E6151 | #ADA088 |
| --ink-3 | #9A9082 | #74695A | #8C928A | **#6E746C** | #9C8E78 | #786A53 |
| --line | #E6DECE | #38322A | #DCE0D9 | **#343A36** | #E2D8C4 | #38301F |
| --line-2 | #D9CFBC | #463F34 | #CBD1C7 | **#424A44** | #D3C6AD | #483E29 |
| --accent | #A85539 | #CD7E5E | #9E5642 | **#C97A5F** | #A5532F | #CC7D52 |
| --accent-bg | #F0E0D6 | #3A2E26 | #EBDFD8 | **#38302B** | #EFDFCE | #3A2C1E |
| --accent-soft | #FAEFE7 | #2E251F | #F4ECE7 | **#2A2622** | #F8EFE2 | #2B2217 |
| --auto-bg / fg | #E8EADC/#5E6B49 | #2F3325/#A6B585 | #E2E8E0/#586B58 | **#2B332B/#9DB18C** | #E5E6D0/#65703F | #2E311C/#A8B57A |
| --praise-bg / fg | #EDE7DA/#7B7058 | #322D24/#B4A88C | #E6E9E2/#67705F | **#2E322B/#B0A98E** | #ECE4D1/#7E6F4F | #322B1C/#B6A77F |
| --err-bg / fg | #EEE3CD/#8A6B3A | #352D1F/#CBA862 | #EAE6D6/#7E6E47 | **#322E22/#C6A86A** | #EBDDBE/#8A6A33 | #362B16/#CFA94E |

**Typography.** Three families: **Newsreader** (serif) for the wordmark/display only; **Hanken Grotesk** (humanist sans) for all UI and body; **IBM Plex Mono** for every code identifier and meta line (counts, paths, keys, eyebrows). Restrained scale, 10.5 → 28px. Tags are uppercase mono with `.07em` tracking; the wordmark uses `-.01em`.

**Backgrounds.** Flat tinted paper. A fixed, full-screen paper-grain overlay sits behind the content at `opacity:.06; mix-blend-mode:overlay` (inline SVG `feTurbulence`). No gradients, no imagery, no full-bleed photography.

**Cards.** `background:var(--surface)`, a single `1px var(--line)` hairline, `border-radius:5px`, no shadow. An urgent card adds a 3px `--accent` rule down the left edge and a 9px seal dot at top-right — the only emphasis treatment.

**Borders & dividers.** Hairlines do all the structural work: `--line` for dividers and card edges, `--line-2` for stronger borders (inputs, draft pill, ensō). Separate rows with a top hairline, not spacing alone.

**Shadows.** Almost none. Depth is tonal. Only the toast (`0 8px 24px rgba(0,0,0,.18)`) and the active segmented item (`0 1px 2px rgba(0,0,0,.05)`) carry shadow.

**Corner radii.** Small and consistent: chips/tags 4px, cards/inputs/buttons 5px, segmented control 6px, toast 8px, scope badge & count pills fully rounded (20px).

**Hover / press.** Quiet. Buttons: primary dims to `opacity:.86`; outline fills to `--surface-2`; ghost lightens text to `--ink`. Links/tabs move toward `--ink`. No scale/bounce on press.

**Motion.** Minimal and soft, and fully tokenized (`tokens/effects.css`). Easings are plain — nothing springs or overshoots: `--ease` (one-shot UI), `--ease-out` (entrances), `--ease-in-out` (symmetric loops — pulse, breathe, shimmer), `--ease-linear` (continuous rotation). Durations: `--dur-fast` (.28s, fades), `--dur-card` (.3s, entrances), `--dur-slow` (.6s, the ceiling for a deliberate transition), and `--pulse` (1.6s, the live-dot period). One-shot keyframes: `ws-appear` (3px rise) for cards and confirmations, `ws-fadeup` for the toast, `ws-shimmer` for skeletons, `ws-spin` while refreshing. The ambient "working / pending" vocabulary is the **OrganicLoader** — eight quiet glyphs (`ws-enso-*` / `ws-ripple` / `ws-breathe*` / `ws-sweep` / `ws-drift` / `ws-sway` / `ws-seam` / `ws-place` in `tokens/base.css`) whose long loop timings are intrinsic to each glyph and stay literal; show one loader at a time, never racing. **Reduced motion:** a `prefers-reduced-motion: reduce` block in `tokens/base.css` collapses every animation and transition to near-instant — every component's visible end-state is its base style, so nothing is load-bearing once motion is removed.

**When to reach for motion.** Animate only when an element *arrives, leaves, or is live* — feedback the user should notice. A static state needs no animation. Pick the token by its job, not its number: `--dur-fast` for fades (opacity in/out, dismiss), `--dur-card` when an element arrives (a card or confirmation rising into place), `--dur-slow` as a hard ceiling no UI transition should exceed, `--pulse` for a live/working dot. Easings pair the same way — `--ease` for one-shot, `--ease-out` for entrances, `--ease-in-out` for symmetric loops, `--ease-linear` for rotation. If something needs to run longer than `--dur-slow`, it's ambient, not a transition — reach for **OrganicLoader** instead.

**Transparency / blur.** None. Surfaces are opaque; the only translucency is the faint grain overlay.

---

## ICONOGRAPHY

There is no icon font and no SVG icon set — deliberately. The interface uses a tiny, functional vocabulary of **Unicode glyphs** rendered in the type itself:

- `⟳` refresh · `↳` annotation · `◆` marker · `✓` completed.
- Status is shown with **CSS shapes**, not icons: a hollow ring (`1.5px` border) = scoped / highlighted; a filled `--accent` dot = urgent; a filled sage dot = active; an open **ensō** (a ring with one quadrant transparent, rotated −20°) = empty state.

No emoji. If you need a richer icon set later, add a thin-stroke line set (e.g. Lucide) and keep it `--ink-2`, 1.5px stroke, to match the hairline language — and flag the addition.

---

## Composition / usage intent

A one-line "reach for this when…" map across the set. Pick by the job, not the look — several primitives share tints, so the unit and context decide.

**Actions**
- **Button** — a discrete action with weight: `primary` for the one decisive action, `outline` for secondary, `ghost` for low-stakes / dismiss.
- **TextButton** — a quiet inline affordance inside dense copy or rows (Undo, Show more). Anything decisive should be a Button.

**State & labels**
- **Badge** — an object's overall state or a small signal pill (`mono` for tracked status, plain for inline signals). `outline` is the draft / de-emphasized treatment.
- **DispositionTag** — a row-level disposition as an uppercase tracked mono chip; `pending` (dashed) for not-started. Badge = the object; DispositionTag = the row.

**Status surfaces**
- **Callout** — the workhorse ambient-status box (left rule + optional dot): `urgent` / `active` / `neutral`, `pulse` only for live states. For anything longer than a status line, it's the wrong tool.
- **OrganicLoader** — a waiting / pending beat; pick a variant by meaning, one on screen at a time.
- **Skeleton** — first-load placeholder before content exists (it already embeds a neutral loader). Use OrganicLoader directly for in-place waits once content is present.

**Acknowledgment**
- **Toast** — a transient, global "it happened" (bottom-center, one at a time). Not for anything needing a decision.
- **Confirmation** — an inline acknowledgment that stays put, often replacing an item's controls; offer Undo for reversible actions.
- **EmptyState** — a calm "nothing here" (the open ensō), never an error.

**Navigation & framing**
- **Tabs** — switch between sibling views; `emphasize` at most one count.
- **ScopeBadge** — toggle a view between everything and a filtered subset.
- **ThemeSwitcher** — swap among the six themes at runtime.

Urgency is a budget, not a palette: `urgent` / accent (the seal), a `pulse`, and an `emphasize`d count all draw the eye — use at most one per view, or they stop meaning "look here."

## Index / manifest

- `styles.css` — global entry (link this). `@import`s everything below.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `fonts.css`, `base.css` (resets + keyframes).
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Motion, Brand).
- `components/`
  - `core/` — **Button**, **TextButton**, **Badge**, **DispositionTag**, **Callout**, **ThemeSwitcher**
  - `feedback/` — **Toast**, **Confirmation**, **EmptyState**, **Skeleton**, **OrganicLoader** (eight quiet pending states)
  - `navigation/` — **Tabs**, **ScopeBadge**
  - each: `<Name>.jsx` + `<Name>.d.ts` + `<Name>.prompt.md`, plus one `*.card.html` per group.
- `SKILL.md` — makes this folder usable as an Agent Skill.

## Theming at runtime

All six themes are defined as `[data-theme]` blocks in `tokens/colors.css`; `:root` defaults to `stone-dark`. Switch live by setting `document.documentElement.dataset.theme` (e.g. `"tea-light"`) — the **ThemeSwitcher** component does exactly this, and retints every token.

## Fonts

Default is Google Fonts (`tokens/fonts.css`). To go fully offline, follow `assets/fonts/README.md`: drop the listed `.woff2` files into `assets/fonts/` and import `assets/fonts/fonts-local.css` from `styles.css` instead. (Binaries aren't bundled.)
