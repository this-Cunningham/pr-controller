# Handoff: PR Controller dashboard

## Overview
A single-screen local dashboard that monitors a developer's open pull requests and shows what an automated agent is doing with each one. The agent polls all open PRs every ~30 minutes, automatically addresses straightforward reviewer feedback (fixes code, replies `fixed`, leaves the thread open for the reviewer to confirm), fixes CI, and rebases merge conflicts — but **surfaces anything that needs the user's judgment.**

**Core job:** make the items that need the user obvious and actionable, while keeping everything the agent is handling glanceable. It is read-mostly with a few inline action controls; there is no navigation — one auto-refreshing page that also receives live "agent working" nudges over a push channel.

**Core mental model — the unit is the ITEM, not the PR.** A single PR can have one thread that needs the user AND another the agent already fixed AND a merge conflict the agent is rebasing — each is a separate *item* that routes to its own tab. So **one PR can appear in more than one tab at once**, each card showing only that tab's slice of items.

The aesthetic is "Wabi-sabi": muted, low-chroma paper/ink palette, hairline borders, a faint paper-grain overlay, a quiet serif wordmark, and a single muted-persimmon "seal" accent reserved for urgency.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing the intended look and behavior. They are **not production code to copy directly**. `support.js` is a prototyping runtime (a tiny streaming-template + React-wrapper layer) and should **not** ship — ignore it when implementing.

The task is to **recreate this design in the target codebase's existing environment** (React, Vue, Svelte, etc.) using its established component patterns, state management, and styling approach. If no front-end environment exists yet, choose the most appropriate framework. The prototype's logic is plain React-style class state and is easy to translate to hooks or any other model.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and interactions are all specified below and present in the prototype. Recreate the UI faithfully using the codebase's existing libraries and patterns; exact tokens are listed in **Design Tokens**.

## Layout shell
- Full-viewport page. Background `var(--bg)`. A fixed, full-screen paper-grain overlay sits behind content (`opacity:.06; mix-blend-mode:overlay`, an inline SVG `feTurbulence` noise) — optional/decorative.
- Content is a single centered column: `max-width:900px; margin:0 auto; padding:34px 28px 120px`.
- A top-right **view switcher** (segmented control) toggles between **Dashboard** (the product) and **Components** (a gallery of every element/state, reference only — does not need to ship).
- Font families: headings/wordmark = **Newsreader** (serif, weight 500); all UI/body = **Hanken Grotesk**; all code identifiers (repo, `path:line`, ticket inputs, counts) = **IBM Plex Mono**.

---

## Screens / Views

### View 1 — Dashboard (the product)
The default view. Top to bottom:

**A. Header bar**
- Layout: flex row, space-between, align-items flex-start, `gap:20px`, `padding-bottom:22px`, `border-bottom:1px solid var(--line)`.
- Left block:
  - Wordmark `PR Controller` — Newsreader, 28px, weight 500, `letter-spacing:-.01em`, `color:var(--ink)`, `white-space:nowrap`.
  - **Scope badge** (button, toggles on click) sits right of the wordmark, `gap:14px`. NOT a safe/live switch — the agent always acts for real on the PRs it can see; this badge only shows WHICH PRs it watches. Two states:
    - **all**: pill, `background:var(--surface-2)`, `color:var(--ink-2)`, 12px; leading 8px filled `var(--auto-fg)` (sage) dot; text `Watching all PRs`.
    - **scoped**: pill, `background:var(--accent-bg)`, `color:var(--accent)`, 12px weight 600; leading 8px hollow ring (`1.5px solid var(--accent)`); text `Scoped · N PRs`.
  - Summary line below (`margin-top:11px`, IBM Plex Mono 13px, `color:var(--ink-2)`): `<N> open · <N> need you · updated <label>`. The "need you" count is wrapped in `color:var(--accent)`.
- Right: **Refresh** button — `padding:9px 15px`, `border:1px solid var(--line-2)`, `border-radius:7px`, `background:var(--surface)`, 13px weight 500; leading `⟳` glyph; while refreshing the glyph spins (`@keyframes spin`, .9s) and label reads `Refreshing…`.

**B. Section tabs** (sticky)
- A tab strip under the header: `position:sticky; top:0; z-index:20; background:var(--bg)`, `border-bottom:1px solid var(--line)`, `padding-top:8px`, flex row wrap.
- Three tabs, in priority order — **Needs you**, **In progress**, **Waiting on reviewer**. Each: Hanken 14.5px weight 600, `padding:14px 0; margin-right:26px; margin-bottom:-1px`; 2px bottom border as the active indicator (active `var(--accent)` + `color:var(--ink)`; inactive transparent + `color:var(--ink-2)`, hover `var(--ink)`).
  - Trailing **count chip**: IBM Plex Mono 11.5px, `padding:1px 8px; border-radius:10px`. The **Needs you** chip is accented when count > 0 (`background:var(--accent-bg); color:var(--accent)`); others neutral. Because the unit is the ITEM, one PR can be counted in more than one tab.
- A caption line under the tabs (`font-size:13px; color:var(--ink-2)`, italic), per tab:
  - Needs you → "Resolve these before the agent continues."
  - In progress → "The agent is working on these — just glance."
  - Waiting on reviewer → "Addressed — waiting on the reviewer."
- Only the **active tab** renders below. Each renders the PR cards that have at least one item routing to that tab (`display:flex; flex-direction:column; gap:14px; margin-top:14px`).
- **Empty state** (the calm ensō): a row with a small open circle (26px, `1.5px solid var(--line-2)`, `border-top-color:transparent`, rotated −20deg) + italic `color:var(--ink-3)` label (e.g. "Nothing needs you right now.").

**D. First-fetch loading** — ~850ms skeleton (`Fetching your open pull requests…` + 3 shimmering placeholder cards), then tabs + content.

### Item routing (the core model)
Each card renders only the items that route to the active tab:
- **Needs you**: threads tagged `input` (needs your input) or `error` (agent error); branch health `surfaced` or `outofsync`; a missing-JIRA banner.
- **In progress**: threads tagged `pending` (no feedback yet); branch health `conflict` (resolving); plus the pulsing "Agent working" cue.
- **Waiting on reviewer**: threads tagged `fixed` (agent fixed · waiting) or `waiting` (you replied).
- `praise` threads show in no tab normally.

A PR appears in every tab it has items for — e.g. one PR with a surfaced reply (Needs you), a fixed thread (Waiting), and a merge conflict (In progress) renders in all three.

---

## Components

### PR card (the repeating unit — renders one tab's slice)
- Container: `position:relative; overflow:hidden; background:var(--surface); border:1px solid var(--line); border-radius:5px; padding:18px 20px 18px 22px`. Mounts with a subtle `appear` animation.
- **Needs-you emphasis** (only in the Needs-you tab): a 3px `var(--accent)` rule on the left edge + a 9px `var(--accent)` "seal" dot at top-right. The same PR is calm in In progress / Waiting.
- **Head row**: PR identifier link `repo #number` (IBM Plex Mono 12.5px, `color:var(--ink-2)`, `1px solid var(--line-2)` underline; hover → accent), title below (`margin-top:7px`, Hanken 15.5px weight 600, `text-wrap:pretty`); right-aligned **review-status pill** (mono 11px uppercase): `APPROVED` (sage), `REVIEW_REQUIRED` (neutral), `DRAFT` (outline).
- **Signal pills** (wrap row, `gap:7px; margin-top:12px`, `font-size:11.5px`): `behind base` (`var(--surface-2)`/`var(--ink-2)`) and `CI failing: <check>` (`var(--accent-bg)`/`var(--accent)`, muted — not a loud red).
- **Agent-working callout** (In progress only): a sage left-ruled callout with a pulsing dot — "Agent working — addressing this PR now."
- **Branch health** (see below).
- **Threads**: zero or more thread rows for that tab.
- **No-threads note** (slice has none): italic `color:var(--ink-3)` — "No open threads — waiting on the reviewer."
- **JIRA banner** (Needs you, optional).
- **Run-agent footer** (Needs you, when ≥1 approach is staged — see StagedApprovalsBar).

### Thread row (one reviewer comment thread)
- `padding:14px 0; border-top:1px solid var(--line)`.
- **Meta line** (flex wrap, `gap:9px`): a **disposition tag** (IBM Plex Mono 10.5px, uppercase, `letter-spacing:.07em`, `padding:3px 8px; border-radius:4px`) + `path:line` + `@author`. Tag vocabulary (label / bg / fg):
  - `input` → "needs your input" / `var(--accent-bg)` / `var(--accent)`
  - `fixed` → "agent fixed · waiting on reviewer" / `var(--auto-bg)` / `var(--auto-fg)`
  - `waiting` → "waiting on reviewer" / `var(--surface-2)` / `var(--ink-2)`
  - `pending` → "no feedback yet" / transparent / `var(--ink-3)` with a **1px dashed `var(--line-2)`** border (faintest)
  - `praise` → "praise" / `var(--praise-bg)` / `var(--praise-fg)`
  - `error` → "agent error" / `var(--err-bg)` / `var(--err-fg)`
- **Comment body** — Hanken 14px, `line-height:1.5`, `text-wrap:pretty`. Long bodies **clamp to 3 lines** (`-webkit-line-clamp`) with a **Show more / Show less** toggle.
- **Agent's reasoning** — `↳` glyph + a one-line summary (12.5px `color:var(--ink-2)`) and a **Show agent's reasoning** toggle that reveals the full rationale (italic, left-ruled `var(--line-2)`).
- **Action controls — vary by tag:**
  - **`input` (needs your input):** up to two agent-drafted aids —
    - **Suggested approach** callout (`background:var(--surface-2)`, `border:1px solid var(--line)`, mono eyebrow) + an **Approve approach** button. Approving **stages** it into the PR's cart (confirmation "✓ Approach staged…" + Undo); a per-PR **Run agent (N)** then fires ONE worker for everything staged. To change the approach, use "Discuss in terminal" rather than editing inline.
    - **Suggested reply** that **pre-fills** an editable reply `<textarea>` + a **Send reply** button → resolves to a quoted "You: …" + "✓ Reply sent to the reviewer." + Undo.
    - plus a **Discuss in terminal** button (opens an interactive session; shows a `›_` terminal note after).
  - **`error`:** an **Open in terminal** button.
  - **`pending` (no feedback yet):** italic caption "The agent is reviewing this now…".
  - **`fixed` / `waiting` / `praise`:** no controls — an italic caption ("No action needed — waiting on the reviewer to confirm." / "…waiting on the reviewer." / "…positive feedback.").

### Branch-health states (PR-level, not a thread)
- **`conflict`** → informational, **pulsing** sage callout: "Resolving merge conflict — the agent is rebasing this; if it can't resolve safely it'll surface it for you." No manual rebase button. (In progress.)
- **`surfaced`** → calm one-line urgency block (`var(--accent-soft)` + `◆`): "Rebase too risky to do automatically — open a terminal to continue." + a **Show details** expander (full reason) + an **Open in terminal** button. (Needs you.)
- **`outofsync`** → urgency block: "Branch has diverged from remote — the agent hasn't run on it." + a **Resolve in terminal** button. (Needs you.)
- Every Needs-you item offers an "open/resolve in terminal" escape hatch.

### StagedApprovalsBar (per-PR cart footer)
- Shown in the Needs-you card when ≥1 approach is staged: `background:var(--surface)`, `border:1px solid var(--line)`. Left: "N approaches staged for this PR." Right: a **Run agent (N)** button (`background:var(--accent)`, `color:#fff`). After running, replaces the button with a `›_ Agent run started — N staged items queued.` note.

### JIRA-needed banner
- Pending: `background:var(--accent-soft); border:1px solid var(--accent-bg)`, `◆` glyph + "This PR's title is missing a ticket key — the compliance check failed. Add one to continue." + an uppercase `<input>` (placeholder `ABC-123`) + **Set ticket**. After set: "✓ Linked to <KEY> — compliance check cleared." (the value is uppercased).

### Toast
- Fixed bottom-center, `background:var(--ink); color:var(--bg); border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,.18)`, leading 7px `var(--accent)` dot, `@keyframes fadeup`, auto-dismiss ~2.8s.

---

## Interactions & Behavior
- **View switcher:** Dashboard ↔ Components.
- **Section tabs:** selecting a tab changes the active slice; sticky on scroll.
- **Scope toggle (all ↔ scoped):** flips the header badge; fires a toast ("Watching all your open PRs" / "Scoped to N allowlisted PRs"). The agent's behavior does not change — only which PRs it watches.
- **Refresh:** ~900ms spinning state, updates the "updated" label, "Up to date" toast.
- **Approve approach:** stages into the PR cart (+Undo). **Run agent (N):** fires one run for all staged items, shows the started note + toast. **Send reply / Open|Resolve|Discuss in terminal / Set ticket:** each transitions the relevant item into its resolved/terminal state and fires a matching toast.
- **Show more / Show agent's reasoning / Show details:** local expand toggles.
- **First-fetch:** ~850ms skeleton.
- **Validation:** Send reply requires non-empty text ("Reply can't be empty"); Set ticket requires non-empty input ("Enter a ticket key, e.g. ABC-123").
- **Animations:** `spin` (refresh), `pulse` / `softpulse` (agent-working & conflict dots), `fadeup` (toast), `appear` (cards + confirmations), `shimmer` (skeleton).

## State Management
Per-PR / per-thread state overlays a static data model. State needed:
- `view`: `'dashboard' | 'components'`
- `tab`: active section (`s1` needs / `s2` progress / `s3` waiting)
- `scope`: `'all' | 'scoped'` (+ `scopeN`)
- `loading`, `refreshing`, `updated`, `toast`
- `threads`: map keyed by thread id → UI flags `{ approachStaged?, replySent?, replyText?, terminalOpen?, bodyExpanded?, reasonOpen? }`
- `branch`: map keyed by PR id → `{ detailsOpen?, terminalOpen? }`
- `runs`: map keyed by PR id → `'running'`
- `jira`: map keyed by PR id → `{ status: 'set', value }`

**Data shape** (mirrors the live `state.json`): each PR has `repo`, `number`, `title`, `review` (`APPROVED|REVIEW_REQUIRED|DRAFT`), optional `jira` (bool), optional `pills` (`{label, kind: 'behind'|'ci'}`), optional `branch` (`{kind: 'conflict'|'surfaced'|'outofsync', detail?, details?}`), and `threads` (`{id, tag: 'input'|'fixed'|'waiting'|'pending'|'praise'|'error', loc, author, body, reasonSummary, reasonFull?, approach?, reply?}`). Tabs are **derived by routing each item** (thread tag / branch kind / jira) to needs / progress / waiting — a PR can land in several.

## Design Tokens
Three palette families (warm earth / cool stone / tea & wood), each with a light and dark variant, exposed as CSS custom properties; all component styling references the variables. The prototype opens in **stone (dark)** by default. Token roles per theme: `--bg`, `--surface`, `--surface-2`, `--ink`/`--ink-2`/`--ink-3`, `--line`/`--line-2`, `--accent`/`--accent-bg`/`--accent-soft` (persimmon seal), `--auto-bg`/`--auto-fg` (sage — fixed/working/positive), `--praise-bg`/`--praise-fg`, `--err-bg`/`--err-fg`. The `no feedback yet` chip uses the faint ink + a dashed border (`--ink-3` / `--line-2`).

**Warm (light):** bg `#F2EDE3` · surface `#FBF8F1` · surface-2 `#F0E9DC` · ink `#2C2823` · ink-2 `#6C6457` · ink-3 `#9A9082` · line `#E6DECE` · line-2 `#D9CFBC` · accent `#A85539` · accent-bg `#F0E0D6` · accent-soft `#FAEFE7` · auto-bg `#E8EADC` · auto-fg `#5E6B49` · praise-bg `#EDE7DA` · praise-fg `#7B7058` · err-bg `#EEE3CD` · err-fg `#8A6B3A`

**Warm (dark):** bg `#211D17` · surface `#2A2620` · surface-2 `#332E26` · ink `#ECE5D8` · ink-2 `#ABA290` · ink-3 `#74695A` · line `#38322A` · line-2 `#463F34` · accent `#CD7E5E` · accent-bg `#3A2E26` · accent-soft `#2E251F` · auto-bg `#2F3325` · auto-fg `#A6B585` · praise-bg `#322D24` · praise-fg `#B4A88C` · err-bg `#352D1F` · err-fg `#CBA862`

**Stone (light):** bg `#EAEDE9` · surface `#F5F7F3` · surface-2 `#E7ECE6` · ink `#272A27` · ink-2 `#5D635B` · ink-3 `#8C928A` · line `#DCE0D9` · line-2 `#CBD1C7` · accent `#9E5642` · accent-bg `#EBDFD8` · accent-soft `#F4ECE7` · auto-bg `#E2E8E0` · auto-fg `#586B58` · praise-bg `#E6E9E2` · praise-fg `#67705F` · err-bg `#EAE6D6` · err-fg `#7E6E47`

**Stone (dark):** bg `#1E211F` · surface `#262A27` · surface-2 `#2F3431` · ink `#E4E7E1` · ink-2 `#A2A89E` · ink-3 `#6E746C` · line `#343A36` · line-2 `#424A44` · accent `#C97A5F` · accent-bg `#38302B` · accent-soft `#2A2622` · auto-bg `#2B332B` · auto-fg `#9DB18C` · praise-bg `#2E322B` · praise-fg `#B0A98E` · err-bg `#322E22` · err-fg `#C6A86A`

**Tea (light):** bg `#EEE8DA` · surface `#F8F3E8` · surface-2 `#ECE4D3` · ink `#2A241C` · ink-2 `#6E6151` · ink-3 `#9C8E78` · line `#E2D8C4` · line-2 `#D3C6AD` · accent `#A5532F` · accent-bg `#EFDFCE` · accent-soft `#F8EFE2` · auto-bg `#E5E6D0` · auto-fg `#65703F` · praise-bg `#ECE4D1` · praise-fg `#7E6F4F` · err-bg `#EBDDBE` · err-fg `#8A6A33`

**Tea (dark):** bg `#20190F` · surface `#292318` · surface-2 `#322B1E` · ink `#ECE3D2` · ink-2 `#ADA088` · ink-3 `#786A53` · line `#38301F` · line-2 `#483E29` · accent `#CC7D52` · accent-bg `#3A2C1E` · accent-soft `#2B2217` · auto-bg `#2E311C` · auto-fg `#A8B57A` · praise-bg `#322B1C` · praise-fg `#B6A77F` · err-bg `#362B16` · err-fg `#CFA94E`

**Type scale:** wordmark 28px / gallery heading 24px / tabs 14.5px / card title 15.5px / body 14px / captions & reasons 12.5–13px / pills 11–11.5px / tags & mono meta 10.5–12px. Weights 400/500/600. Fonts: Newsreader (serif), Hanken Grotesk (sans), IBM Plex Mono (mono).

**Radii:** chips/pills/buttons 4–5px; cards 5px; count chips & scope-badge pills 10–20px (full-round feel); toast 8px.

**Shadows:** minimal (Wabi-sabi). Only the toast (`0 8px 24px rgba(0,0,0,.18)`) and the active segmented-control item (`0 1px 2px rgba(0,0,0,.05)`) use shadow.

## Assets
- **Fonts:** Google Fonts — Newsreader, Hanken Grotesk, IBM Plex Mono.
- **Paper-grain overlay:** an inline SVG `feTurbulence` data-URI, decorative only.
- No raster images; glyphs used (`⟳`, `↳`, `◆`, `›_`, `✓`, dots/rings) are Unicode or simple CSS shapes.

## Files
- `PR Controller.dc.html` — the full interactive prototype (markup + logic + tokens). Open in any browser to see all states and interactions.
- `support.js` — **prototyping runtime only; do not ship.**
