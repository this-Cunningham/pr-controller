# Wabi-Sabi Design System

A design system for **PR Controller** — a local, single-screen dashboard that monitors a
developer's open pull requests and shows what an automated agent is doing with each one. The
agent polls open PRs, auto-handles straightforward reviewer feedback, fixes CI and rebases,
and **surfaces only what needs the developer's judgment**.

The visual language is **Wabi-sabi**: beauty in imperfection, transience, and natural
simplicity — uncluttered space, raw muted materials, an appreciation for the worn and quiet.
In UI terms that means a paper/ink palette at low chroma, hairline borders instead of
shadows, generous negative space (*ma*), a faint paper grain, and a single restrained
persimmon "seal" accent used only where attention is genuinely required.

## Sources

- Built from the PR Controller prototype in this workspace (`PR Controller.dc.html`) and its
  React port (`pr-controller-react/`). Element names mirror the agent's live `state.json`.
- No external brand or Figma; the system was designed for this product.

## Using the system

Link the single entry point and use the CSS custom properties:

```html
<link rel="stylesheet" href="styles.css" />
```

`styles.css` `@import`s the tokens (`tokens/*.css`) and webfonts. Components are React and
reference the tokens — never hard-coded colors.

---

## CONTENT FUNDAMENTALS

How copy is written in this product:

- **Voice:** calm, plain, and precise. Short declaratives. The tool is an assistant that
  defers to you — it never hypes.
- **Person:** addresses the user as **you** ("Resolve these before the agent continues.",
  "No action needed from you."). The automation is **the agent** ("The agent will apply this
  fix.", "applied by the agent").
- **Casing:** sentence case everywhere in prose and buttons ("Approve fix", "Set ticket").
  Tags and pills are the deliberate exception — lowercase, uppercased *visually* via CSS with
  letter-spacing ("disagree · hash out", "agree · auto-fix").
- **Status, not alarm:** failures are stated flatly, never shouted. "CI failing: unit-api",
  "The agent couldn't classify this automatically." No exclamation, no red sirens.
- **Confirmations** lead with a `✓` and name the actor: "✓ Fix approved — applied by the
  agent." Reversible actions always offer **Undo**.
- **Reasons:** every agent classification carries a one-line rationale, prefixed `↳`, e.g.
  "↳ Mechanical refactor, no behavior change — safe to auto-apply."
- **Numerals:** spare. Counts and code identifiers only; no decorative stats.
- **Punctuation:** middot `·` separates peers ("agree · auto-fix", "6 open · 2 need you");
  arrow `↳` introduces a reason; `›_` marks a terminal hand-off.
- **No emoji.** The only glyphs are functional: `⟳` refresh, `↳` reason, `◆` compliance,
  `›_` terminal, `✓` done, and hollow/filled circles for status.

---

## VISUAL FOUNDATIONS

**Palette.** Muted and low-chroma throughout. The shipped, locked theme is **stone · dark**
(charcoal grey-green ground, soft off-white ink). Surfaces step `--bg #1E211F` → `--surface
#262A27` → `--surface-2 #2F3431`; ink steps `--ink #E4E7E1` → `--ink-2 #A2A89E` → `--ink-3
#6E746C`. The one accent is a warm persimmon **seal** `--accent #C97A5F`, used only for
urgency (the "needs you" rule + dot, CI-failure pill, hash-out tag, compliance banner, toast
dot, the live-mode dot). Muted semantic tints: **sage** (auto/approved/positive), **praise**,
**ochre** (agent error — calm, not alarming).

The system is built across **six themes** — `warm`, `stone`, `tea` × `light`, `dark`. Swap
the `:root` block in `tokens/colors.css` to retheme. Full values:

| token | warm·light | warm·dark | stone·light | stone·dark | tea·light | tea·dark |
|---|---|---|---|---|---|---|
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

**Typography.** Three families: **Newsreader** (serif) for the wordmark/display only;
**Hanken Grotesk** (humanist sans) for all UI and body; **IBM Plex Mono** for every code
identifier and meta line (repo#, `path:line`, ticket keys, counts, eyebrows). Restrained
scale, 10.5 → 28px. Tags are uppercase mono with `.07em` tracking; the wordmark uses `-.01em`.

**Backgrounds.** Flat tinted paper. A fixed, full-screen paper-grain overlay sits behind the
content at `opacity:.06; mix-blend-mode:overlay` (inline SVG `feTurbulence`). No gradients, no
imagery, no full-bleed photography.

**Layout.** A single centered column, `max-width:900px`, `padding:34px 28px 120px`. Sections
stack; PR cards stack at a 14px rhythm. The section tabs are **sticky** to the top on scroll.

**Cards.** `background:var(--surface)`, a single `1px var(--line)` hairline, `border-radius:5px`,
no shadow. Urgent ("needs you") cards add a 3px `--accent` rule down the left edge and a 9px
seal dot at top-right — the only emphasis treatment.

**Borders & dividers.** Hairlines do all the structural work: `--line` for dividers and card
edges, `--line-2` for stronger borders (inputs, draft pill, ensō). Threads are separated by a
top hairline, not spacing alone.

**Shadows.** Almost none. Depth is tonal. Only the toast (`0 8px 24px rgba(0,0,0,.18)`) and
the active segmented item (`0 1px 2px rgba(0,0,0,.05)`) carry shadow.

**Corner radii.** Small and consistent: chips/tags 4px, cards/inputs/buttons 5px, segmented
control 6px, toast 8px, mode badge & count pills fully rounded (20px).

**Hover / press.** Quiet. Buttons: primary dims to `opacity:.86`; outline fills to
`--surface-2`; ghost lightens text to `--ink`. Links/tabs move toward `--ink`; the PR link
shifts to `--accent`. No scale/bounce on press.

**Motion.** Minimal and soft. `ws-appear` (3px rise, .3s) for cards and confirmations;
`ws-fadeup` (.28s) for the toast; `ws-shimmer` for skeletons; `ws-pulse` (1.6s) for the
live-mode dot — the single piece of ambient motion, and only when the agent is acting.
`ws-spin` only while refreshing. Easing is plain `ease`; nothing springs.

**Transparency / blur.** None. Surfaces are opaque; the only translucency is the faint grain
overlay.

---

## ICONOGRAPHY

There is no icon font and no SVG icon set — deliberately. The interface uses a tiny,
functional vocabulary of **Unicode glyphs** rendered in the type itself:

- `⟳` refresh · `↳` reason · `◆` compliance/JIRA · `›_` terminal hand-off · `✓` completed.
- Status is shown with **CSS shapes**, not icons: a hollow ring (`1.5px` border) = safe /
  idle; a filled `--accent` dot = live / urgent; an open **ensō** (a ring with one quadrant
  transparent, rotated −20°) = empty state.

No emoji. If you need a richer icon set later, add a thin-stroke line set (e.g. Lucide) and
keep it `--ink-2`, 1.5px stroke, to match the hairline language — and flag the addition.

---

## Index / manifest

- `styles.css` — global entry (link this). `@import`s everything below.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `fonts.css`,
  `base.css` (resets + keyframes).
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand).
- `components/`
  - `core/` — **Button**, **Badge**, **DispositionTag**, **ThemeSwitcher**
  - `feedback/` — **Toast**, **Confirmation**, **EmptyState**, **Skeleton**
  - `navigation/` — **Tabs**, **ModeBadge**
  - `pr/` — **PRCard**, **ThreadRow**, **JiraBanner** (product compositions, built on the above)
  - each: `<Name>.jsx` + `<Name>.d.ts` + `<Name>.prompt.md`, plus one `*.card.html` per group.
- `ui_kits/pr-controller/` — assembled interactive dashboard (`index.html`).
- `pr-controller-react/` — full reference React app (Vite) the system was extracted from.
- `PR Controller.dc.html` — the original interactive prototype.
- `SKILL.md` — makes this folder usable as an Agent Skill.

## Product-specific compositions

`PRCard`, `ThreadRow` and `JiraBanner` are product compositions assembled from the
core/feedback/navigation primitives. They are controlled — pass a single `controller`
object (see `components/pr/ThreadRow.d.ts` → `PRController`) that owns thread/JIRA state
and exposes `threadStatus`, `approve`, `skip`, `discuss`, `undo`, `sendRebuttal`,
`jiraValue`, `setTicket`. The reference React app's `useDashboard` hook is one such controller.

## Theming at runtime

All six themes are defined as `[data-theme]` blocks in `tokens/colors.css`; `:root` defaults
to `stone-dark`. Switch live by setting `document.documentElement.dataset.theme` (e.g.
`"tea-light"`) — the **ThemeSwitcher** component does this, and the UI kit header includes it.

## Fonts

Default is Google Fonts (`tokens/fonts.css`). To go fully offline, follow
`assets/fonts/README.md`: drop the listed `.woff2` files into `assets/fonts/` and import
`assets/fonts/fonts-local.css` from `styles.css` instead. (Binaries aren't bundled — I
couldn't fetch them in this environment.)
