# Handoff: PR Controller dashboard

## Overview
A single-screen local dashboard that monitors a developer's open pull requests and shows what an automated agent is doing with each one. The agent polls all open PRs every ~30 minutes, auto-handles straightforward reviewer feedback (fixes code, replies, resolves threads), fixes CI, and rebases — but surfaces anything that needs the user's judgment.

**Core job:** make the PRs that need the user's attention obvious and actionable, while keeping the rest glanceable. It is read-mostly with a few inline action controls; there is no navigation — it's one auto-refreshing page.

The aesthetic is "Wabi-sabi": muted, low-chroma paper/ink palette, hairline borders, a faint paper-grain overlay, a quiet serif wordmark, and a single muted-persimmon "seal" accent reserved for urgency.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing the intended look and behavior. They are **not production code to copy directly**. `support.js` is a prototyping runtime (a tiny streaming-template + React-wrapper layer) and should **not** ship — ignore it when implementing.

The task is to **recreate this design in the target codebase's existing environment** (React, Vue, Svelte, etc.) using its established component patterns, state management, and styling approach. If no front-end environment exists yet, choose the most appropriate framework and implement there. The prototype's logic is plain React-style class state and is easy to translate to hooks or any other model.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and interactions are all specified below and present in the prototype. Recreate the UI faithfully using the codebase's existing libraries and patterns; exact tokens are listed in **Design Tokens**.

## Layout shell
- Full-viewport page. Background `var(--bg)`. A fixed, full-screen paper-grain overlay sits behind content (`opacity:.06; mix-blend-mode:overlay`, an inline SVG `feTurbulence` noise) — optional/decorative.
- Content is a single centered column: `max-width:900px; margin:0 auto; padding:34px 28px 120px`.
- A top-right **view switcher** (segmented control) toggles between two views: **Dashboard** (the product) and **Components** (a gallery of every element/state, for reference only — does not need to ship).
- Font families: headings/wordmark = **Newsreader** (serif, weight 500); all UI/body = **Hanken Grotesk**; all code identifiers (repo, `path:line`, ticket inputs, counts) = **IBM Plex Mono**.

---

## Screens / Views

### View 1 — Dashboard (the product)
The default view. Top to bottom:

**A. Header bar**
- Layout: flex row, space-between, align-items flex-start, `gap:20px`, `padding-bottom:22px`, `border-bottom:1px solid var(--line)`.
- Left block:
  - Wordmark `PR Controller` — Newsreader, 28px, weight 500, `letter-spacing:-.01em`, `color:var(--ink)`, `white-space:nowrap`.
  - **Mode badge** (button, toggles on click) sits to the right of the wordmark, `gap:14px`. Two states:
    - **safe**: pill, `background:var(--surface-2)`, `color:var(--ink-2)`, 12px; leading 9px hollow circle (`1.5px solid var(--ink-3)`); text `Safe — no actions taken`; `white-space:nowrap`.
    - **live**: pill, `background:var(--accent-bg)`, `color:var(--accent)`, 12px weight 600; leading 8px filled `var(--accent)` dot that **pulses** (`@keyframes pulse` opacity 1→.3→1, 1.6s ease-in-out infinite); text `Live`.
  - Summary line below (`margin-top:11px`, IBM Plex Mono 13px, `color:var(--ink-2)`): `<N> open · <N> need you · updated <label>`. The "need you" count is wrapped in `color:var(--accent)`.
- Right: **Refresh** button — flex none, `padding:9px 15px`, `border:1px solid var(--line-2)`, `border-radius:7px`, `background:var(--surface)`, `color:var(--ink)`, 13px weight 500; leading `⟳` glyph. Hover `background:var(--surface-2)`. While refreshing, the glyph spins (`@keyframes spin`, .9s linear infinite) and label reads `Refreshing…`.

**B. Section tabs** (sticky)
- A tab strip directly under the header that is **`position:sticky; top:0; z-index:20; background:var(--bg)`**, `border-bottom:1px solid var(--line)`, `padding-top:8px`, flex row wrap.
- Three tabs, in priority order: **Needs you**, **Auto-handling**, **Waiting on reviewer**. Each tab is a button: Hanken 14.5px weight 600, `padding:14px 0; margin-right:26px; margin-bottom:-1px`; a 2px bottom border (the active indicator).
  - Active tab: `color:var(--ink)`, bottom border `var(--accent)`.
  - Inactive tab: `color:var(--ink-2)`, bottom border `transparent`; hover → `color:var(--ink)`.
  - Each tab shows a trailing **count chip**: IBM Plex Mono 11.5px, `padding:1px 8px; border-radius:10px`. The **Needs you** chip is accented when count > 0 (`background:var(--accent-bg); color:var(--accent)`); all other chips are neutral (`background:var(--surface-2); color:var(--ink-2)`).
- Only the **active section** renders below the tabs (one section at a time). Selecting a tab swaps the visible section.

**C. Active section body**
- A short caption line under the tabs (`font-size:13px; color:var(--ink-2)`), per section:
  - Needs you → "Resolve these before the agent continues."
  - Auto-handling → live mode: "The agent is fixing these — just glance." / safe mode: "Paused in safe mode — these would be auto-fixed when live."
  - Waiting on reviewer → "No action needed from you."
- Then a vertical stack of **PR cards** (`display:flex; flex-direction:column; gap:14px; margin-top:14px`).
- **Empty state** (when a section has no PRs): a row with a small open "ensō" circle (26px, `1.5px solid var(--line-2)`, `border-top-color:transparent`, rotated −20deg) + italic `color:var(--ink-3)` label (e.g. "Nothing flagged.").

**D. First-fetch loading** — on initial load the dashboard shows a skeleton (`Fetching your open pull requests…` + 3 placeholder cards with shimmering bars, `@keyframes shimmer` opacity .5↔.85) for ~850ms, then reveals tabs + content.

### View 2 — Components gallery (reference only)
Not part of the shipping product — a catalog showing: header bar (safe & live), all status pills, all thread disposition tags, the loading skeleton, and labeled frames demonstrating every PR-card and thread-row state (needs-you emphasis, calm, dense, no-threads, all dispositions, post-action confirmations, JIRA banner pending+linked, empty section). Use it as a visual spec for the states described below.

---

## Components

### PR card (the repeating unit)
- Container: `position:relative; overflow:hidden; background:var(--surface); border:1px solid var(--line); border-radius:5px; padding:18px 20px 18px 22px`. Mounts with a subtle `appear` animation (opacity 0→1, translateY 3px→0, .3s ease).
- **Needs-you emphasis** (only in the Needs-you section): a 3px-wide vertical `var(--accent)` rule pinned to the card's left edge (`position:absolute; left:0; top:0; bottom:0`), plus a 9px filled `var(--accent)` "seal" dot at top-right (`top:15px; right:15px`).
- **Head row** (flex, space-between, align flex-start, `gap:16px`):
  - Left: PR identifier link `repo #number` — IBM Plex Mono 12.5px, `color:var(--ink-2)`, no underline but a `1px solid var(--line-2)` bottom border; hover → `color:var(--accent)` + accent bottom border. Below it (`margin-top:7px`) the PR title — Hanken 15.5px weight 600, `color:var(--ink)`, `line-height:1.45`, `text-wrap:pretty`.
  - Right: **review-status pill** (flex none, IBM Plex Mono 11px, uppercase, `letter-spacing:.06em`, `padding:4px 9px; border-radius:4px; white-space:nowrap`). Three states:
    - `APPROVED` → label "Approved", `background:var(--auto-bg)`, `color:var(--auto-fg)`, border transparent.
    - `REVIEW_REQUIRED` → label "Review required", `background:var(--surface-2)`, `color:var(--ink-2)`, border transparent.
    - `DRAFT` → label "Draft", `background:transparent`, `color:var(--ink-3)`, `border:1px solid var(--line-2)`.
- **Optional status pills** (wrap row, `gap:7px; margin-top:12px`), each `font-size:11.5px; padding:3px 9px; border-radius:4px`. May appear together:
  - "N auto-fixable" → `background:var(--surface-2)`, `color:var(--ink-2)`, with a leading 5px `currentColor` dot.
  - "behind base" → `background:var(--surface-2)`, `color:var(--ink-2)`.
  - "CI failing: <check>" → `background:var(--accent-bg)`, `color:var(--accent)` (muted, not a loud red).
- **Threads**: zero or more thread rows (see below).
- **No-threads note** (when a card has no threads and no JIRA banner): `border-top:1px solid var(--line)`, italic `color:var(--ink-3)` 12.5px — "No open threads — waiting on the reviewer."
- **JIRA banner** (optional, see below).

### Thread row (one reviewer comment thread)
- `padding:14px 0; border-top:1px solid var(--line)`.
- **Meta line** (flex wrap, `gap:9px`, align center):
  - **Disposition tag** — IBM Plex Mono 10.5px, uppercase, `letter-spacing:.07em`, `padding:3px 8px; border-radius:4px`. Five states (label / bg / fg):
    - `hash-out` → "disagree · hash out" / `var(--accent-bg)` / `var(--accent)`
    - `agree-fix` → "agree · auto-fix" / `var(--auto-bg)` / `var(--auto-fg)`
    - `waiting-reviewer` → "waiting on reviewer" / `var(--surface-2)` / `var(--ink-2)`
    - `praise` → "praise" / `var(--praise-bg)` / `var(--praise-fg)`
    - `error` → "agent error" / `var(--err-bg)` / `var(--err-fg)`
  - File location `path:line` — IBM Plex Mono 12px, `color:var(--ink-3)`.
  - Author handle `@name` — IBM Plex Mono 12px, `color:var(--ink-2)`.
- **Comment body** — Hanken 14px, `line-height:1.5`, `color:var(--ink)`, `text-wrap:pretty`. **Truncation:** `max-height:88px; overflow-y:auto; padding-right:6px` (long bodies scroll within the row).
- **Reason caption** — `margin-top:7px`, 12.5px `color:var(--ink-2)`, prefixed with a `↳` glyph in `var(--ink-3)`. One-line explanation of the agent's classification.
- **Action controls — vary by tag** (`margin-top:~11px`):
  - **hash-out:** a multi-line rebuttal `<textarea>` (full width, `min-height ~2 rows`, 13.5px, `border:1px solid var(--line-2)`, `border-radius:5px`, `background:var(--surface)`, `color:var(--ink)`; focus → border `var(--accent)`, no outline; placeholder "Why do you disagree? This goes back to the reviewer.") **plus** a button row: **"Discuss in terminal"** (primary — `background:var(--ink)`, `color:var(--bg)`, hover `opacity:.86`) and **"Send rebuttal"** (outline — transparent bg, `color:var(--ink)`, `border:1px solid var(--line-2)`, hover `background:var(--surface-2)`).
    - After Discuss: an inline note (`›_` accent glyph) "Terminal session opened — continue the discussion there." appears above the still-present input.
    - After Send (rebuttal submitted): the input/buttons are replaced by the quoted rebuttal (`background:var(--surface-2)`, `border-left:2px solid var(--line-2)`, "You: …") + "✓ Rebuttal sent to the reviewer." (`color:var(--auto-fg)`) + an **Undo** link (`color:var(--accent)`, underline).
  - **agree-fix:** caption "The agent will apply this fix." + buttons **"Approve fix"** (primary) and **"Skip"** (ghost — transparent, `color:var(--ink-2)`, hover `color:var(--ink)`).
    - After Approve: "✓ Fix approved — applied by the agent." (`color:var(--auto-fg)`) + Undo link.
    - After Skip: "Skipped — left for you." (`color:var(--ink-2)`) + Undo link.
  - **waiting-reviewer / praise:** no controls — just an italic `color:var(--ink-3)` caption ("No action needed — waiting on the reviewer." / "No action needed — positive feedback.").
  - **error:** caption "The agent couldn't classify this automatically." + an outline **"Open in terminal"** button → after click, "Terminal session opened." note.

### JIRA-needed banner (on a card whose compliance check failed for a missing ticket)
- Pending: a block `background:var(--accent-soft); border:1px solid var(--accent-bg); border-radius:5px; padding:13px 14px`. Leading `◆` accent glyph + text "This PR's title is missing a ticket key — the compliance check failed. Add one to continue." Below: a small `<input>` (IBM Plex Mono 13px, `text-transform:uppercase`, `width:140px`, `border:1px solid var(--line-2)`, focus border `var(--accent)`, placeholder `ABC-123`) + primary **"Set ticket"** button.
- After set: replaced by "✓ Linked to <KEY> — compliance check cleared." (`color:var(--auto-fg)`). The entered value is uppercased.

### Toast (confirmation after any action)
- Fixed, bottom-center: `left:50%; bottom:28px; transform:translateX(-50%); background:var(--ink); color:var(--bg); font-size:13px; padding:11px 17px; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,.18)`. Leading 7px `var(--accent)` dot. Enters via `@keyframes fadeup` (opacity + 10px rise, .28s ease). Auto-dismisses after ~2.8s.

---

## Interactions & Behavior
- **View switcher:** toggles Dashboard ↔ Components.
- **Section tabs:** selecting a tab changes which section renders; tabs are sticky on scroll.
- **Mode toggle (safe ↔ live):** flips the header badge and changes the Auto-handling caption; fires a toast ("Live — the agent will act automatically" / "Safe — actions paused, nothing will change").
- **Refresh:** sets a spinning state for ~900ms, updates the "updated" label to "just now", fires "Up to date" toast.
- **Approve fix / Skip / Discuss in terminal / Open in terminal / Send rebuttal / Set ticket:** each transitions the relevant thread (or banner) into its confirmation state and fires a matching toast. Approve/Skip/Send rebuttal each expose an **Undo** that returns the thread to pending.
- **First-fetch:** ~850ms skeleton on initial load.
- **Validation:** Send rebuttal requires non-empty text (else toast "Type why you disagree first"); Set ticket requires non-empty input (else toast "Enter a ticket key, e.g. ABC-123").
- **Animations:** `spin` (refresh), `pulse` (live dot), `fadeup` (toast), `appear` (cards + confirmations), `shimmer` (skeleton). Durations/easings noted inline above.

## State Management
Per-PR and per-thread state overlays a static data model. State needed:
- `view`: `'dashboard' | 'components'`
- `tab`: which section is active (`needs` / `auto` / `waiting`)
- `mode`: `'safe' | 'live'`
- `loading`: first-fetch flag
- `refreshing`: refresh-in-flight flag
- `updated`: last-updated label string
- `toast`: current toast message (or null; auto-clears on a timer)
- `threads`: map keyed by thread id → `{ status: 'pending'|'approved'|'skipped'|'discussing'|'rebutted', rebuttal?: string }`
- `jira`: map keyed by PR id → `{ status: 'set', value: string }`

**Data fetching:** the prototype uses mock PR data hard-coded in the logic class (objects `pr2412`, `pr874`, `pr2399`, `pr561`, `pr2380`, `pr203`, grouped into `needs` / `auto` / `waiting`). In production this should come from the PR-agent backend. The data shape intentionally mirrors the live `state.json`: each PR has `repo`, `number`, `title`, `review` (`APPROVED|REVIEW_REQUIRED|DRAFT`), `jira` (bool), `pills` (`{label, kind: 'auto'|'behind'|'ci'}`), and `threads` (`{id, tag: 'hashout'|'agree'|'waiting'|'praise'|'error', loc, author, body, reason}`). Sections are derived by routing PRs to needs/auto/waiting.

## Design Tokens
The design ships **three palette families** (warm earth / cool stone / tea & wood), each with a **light and dark** variant, exposed as CSS custom properties. All component styling references the variables — implement them as themeable tokens. The prototype opens standalone in **stone (dark)** by default; warm and tea are the other families, each with light/dark variants. Treat the palette/appearance as themeable — none is "the" only correct theme.

Token roles (per theme): `--bg` (page), `--surface` (card), `--surface-2` (insets/neutral chips), `--ink` / `--ink-2` / `--ink-3` (text: primary/secondary/faint), `--line` / `--line-2` (hairline borders), `--accent` / `--accent-bg` / `--accent-soft` (persimmon seal: text, tint, faint tint), `--auto-bg`/`--auto-fg` (sage — approved/auto/positive), `--praise-bg`/`--praise-fg`, `--err-bg`/`--err-fg`.

**Warm (light):** bg `#F2EDE3` · surface `#FBF8F1` · surface-2 `#F0E9DC` · ink `#2C2823` · ink-2 `#6C6457` · ink-3 `#9A9082` · line `#E6DECE` · line-2 `#D9CFBC` · accent `#A85539` · accent-bg `#F0E0D6` · accent-soft `#FAEFE7` · auto-bg `#E8EADC` · auto-fg `#5E6B49` · praise-bg `#EDE7DA` · praise-fg `#7B7058` · err-bg `#EEE3CD` · err-fg `#8A6B3A`

**Warm (dark):** bg `#211D17` · surface `#2A2620` · surface-2 `#332E26` · ink `#ECE5D8` · ink-2 `#ABA290` · ink-3 `#74695A` · line `#38322A` · line-2 `#463F34` · accent `#CD7E5E` · accent-bg `#3A2E26` · accent-soft `#2E251F` · auto-bg `#2F3325` · auto-fg `#A6B585` · praise-bg `#322D24` · praise-fg `#B4A88C` · err-bg `#352D1F` · err-fg `#CBA862`

**Stone (light):** bg `#EAEDE9` · surface `#F5F7F3` · surface-2 `#E7ECE6` · ink `#272A27` · ink-2 `#5D635B` · ink-3 `#8C928A` · line `#DCE0D9` · line-2 `#CBD1C7` · accent `#9E5642` · accent-bg `#EBDFD8` · accent-soft `#F4ECE7` · auto-bg `#E2E8E0` · auto-fg `#586B58` · praise-bg `#E6E9E2` · praise-fg `#67705F` · err-bg `#EAE6D6` · err-fg `#7E6E47`

**Stone (dark):** bg `#1E211F` · surface `#262A27` · surface-2 `#2F3431` · ink `#E4E7E1` · ink-2 `#A2A89E` · ink-3 `#6E746C` · line `#343A36` · line-2 `#424A44` · accent `#C97A5F` · accent-bg `#38302B` · accent-soft `#2A2622` · auto-bg `#2B332B` · auto-fg `#9DB18C` · praise-bg `#2E322B` · praise-fg `#B0A98E` · err-bg `#322E22` · err-fg `#C6A86A`

**Tea (light):** bg `#EEE8DA` · surface `#F8F3E8` · surface-2 `#ECE4D3` · ink `#2A241C` · ink-2 `#6E6151` · ink-3 `#9C8E78` · line `#E2D8C4` · line-2 `#D3C6AD` · accent `#A5532F` · accent-bg `#EFDFCE` · accent-soft `#F8EFE2` · auto-bg `#E5E6D0` · auto-fg `#65703F` · praise-bg `#ECE4D1` · praise-fg `#7E6F4F` · err-bg `#EBDDBE` · err-fg `#8A6A33`

**Tea (dark):** bg `#20190F` · surface `#292318` · surface-2 `#322B1E` · ink `#ECE3D2` · ink-2 `#ADA088` · ink-3 `#786A53` · line `#38301F` · line-2 `#483E29` · accent `#CC7D52` · accent-bg `#3A2C1E` · accent-soft `#2B2217` · auto-bg `#2E311C` · auto-fg `#A8B57A` · praise-bg `#322B1C` · praise-fg `#B6A77F` · err-bg `#362B16` · err-fg `#CFA94E`

**Type scale:** wordmark 28px / section gallery heading 24px / tabs 14.5px / section title 17px / card title 15.5px / body 14px / captions & reasons 12.5–13px / pills 11–11.5px / tags & mono meta 10.5–12px. Weights 400/500/600. Fonts: Newsreader (serif), Hanken Grotesk (sans), IBM Plex Mono (mono).

**Radii:** chips/pills/buttons 4–5px; cards 5px; count chips & mode badge pills 10–20px (full-round feel); toast 8px.

**Shadows:** intentionally minimal (Wabi-sabi). Only the toast (`0 8px 24px rgba(0,0,0,.18)`) and the active segmented-control item (`0 1px 2px rgba(0,0,0,.05)`) use shadow.

## Assets
- **Fonts:** Google Fonts — Newsreader, Hanken Grotesk, IBM Plex Mono. (Avoid these only if your codebase mandates a different type system; otherwise match.)
- **Paper-grain overlay:** an inline SVG `feTurbulence` data-URI, decorative only — reproduce with an equivalent noise overlay or omit.
- No raster images or icon assets; the few glyphs used (`⟳`, `↳`, `◆`, `›_`, `✓`, hollow/filled circles) are Unicode or simple CSS shapes. Replace with your icon set if preferred.

## Files
- `PR Controller.dc.html` — the full interactive prototype (markup + logic + tokens). Open in any browser to see all states and interactions. The logic lives in the `<script data-dc-script>` block; tokens are the CSS custom properties in the `<style>` block in `<head>`/helmet.
- `support.js` — **prototyping runtime only; do not ship.** Provided so the HTML opens standalone.
