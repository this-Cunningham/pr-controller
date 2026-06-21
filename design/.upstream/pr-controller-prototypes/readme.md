# PR-Controller — prototype workspace

This is the **PR-Controller product prototype workspace**, built on the bound
**Wabi-Sabi design system** (the *foundation*). It owns the PR-Controller
**product layer** — the compositions and assembled screens for the local,
single-screen dashboard that monitors a developer's open pull requests and
shows what an automated agent is doing with each one. The agent polls open PRs,
auto-handles straightforward reviewer feedback, fixes CI and rebases, and
**surfaces only what needs the developer's judgment**.

All visual language — color, type, spacing, radii, shadows, motion, and the UI
primitives — comes from the foundation. **Nothing visual is defined here.** See
`_ds/wabi-sabi-design-system-b6b92dd7-9602-4f5c-8ee1-731fe945db55/` (and the full
source at the bound project) for tokens and primitives.

---

## What's here

Three **Design Components**, composed with `dc-import` — no build step:

| Path | What it is |
| --- | --- |
| `PR Controller.dc.html` | **App shell + entrypoint.** Logic class = the `controller` + all UI state; template = header, view switch (**Dashboard ⇄ Swimlanes**), and Toast. Loads the foundation bundle + token CSS once in `<helmet>`. |
| `PRCard.dc.html` | The repeating **PR unit** — a pure per-lane renderer. Mounts `ThreadRow`; inlines the branch / JIRA / staged-cart / agent-working / terminal markup. |
| `ThreadRow.dc.html` | One reviewer comment **thread**, with its own local UI state (reply draft, body clamp, reasoning toggle). |

Both product views render from the same compositions, controller, and mock data:

- **Dashboard** — the tabbed single-column product view (sticky lane Tabs over a
  stacked list of full PRCards).
- **Swimlanes** — every PR visible at once across three lane columns as compact
  mini-cards; click one to expand the full PRCard in a modal.

### How styling works

**Inline token styles** — every value is a foundation token referenced via
`var(--*)` (`style="padding:var(--space-4);color:var(--ink)"`); no component
hardcodes a hex, and there are no CSS classes or stylesheets. This is the native
Design Component style and exactly how the bound foundation authors its own
components. State-driven styles (the active toggle segment, accent column
borders, the staged dot) are computed as style objects in `renderVals()`.

> These DCs are **design references**, not production source. A developer
> reimplements them in the app's real environment using the **tokens** +
> component contracts as the spec — the inline styles are the prototype medium,
> not something to port literally.

### Composition (no build step)

- Foundation primitives mount via
  `<x-import component-from-global-scope="DesignSystem_220c99.<Name>" …>`.
- Product compositions mount via `<dc-import name="PRCard" …>` /
  `<dc-import name="ThreadRow" …>`. The `controller` passes down as a prop; child
  DC local state survives parent re-renders, so reply drafts/toggles persist.
- Editing a DC needs **no rebuild** — `dc-import` resolves siblings directly.

---

## The lane model

Placement is **server-authoritative**: the daemon decides which lane every item
belongs to and ships a flat, ordered list of rows. The board renders three lanes:

| Lane | Meaning | Caption |
| --- | --- | --- |
| **needs** (Needs you) | Items that need the developer's judgment before the agent can continue. | "Resolve these before the agent continues." |
| **progress** (In progress) | The agent is actively working — just glance. | "The agent is working on these — just glance." |
| **waiting** (Waiting on reviewer) | Addressed by the agent — now waiting on a human reviewer. | "Addressed — waiting on the reviewer." |

`PRCard({ pr, lane, items, controller })` is a **pure per-lane renderer**: it
renders the `items` it is handed, in order, and routes nothing. `lane` drives
**emphasis only** — the 3px accent rule + 9px seal dot, shown for `needs`.

A row (`item`) is one of: `{ kind: "thread", thread }`, `{ kind: "branch",
branch }`, `{ kind: "jira" }`, `{ kind: "agentWorking", text }`. In this
prototype, the app shell's logic class (`buildItems`) plays the daemon: it maps
thread disposition tags and branch state onto lanes (`TAG_LANE` / `BRANCH_LANE`)
and produces the ordered `items` per lane. `TAG_LANE.praise = null` (praise
threads aren't surfaced), and the In-progress lane carries a generic
agent-working cue, suppressed when a conflict branch already shows one.

### Thread dispositions

Each reviewer comment thread carries an agent **disposition tag**:

- `input` — needs your input (the agent drafted a *Suggested approach* you can
  stage into the PR cart, and/or a pre-filled editable *Suggested reply*).
- `fixed` — the agent fixed it and replied; waiting on the reviewer to confirm.
- `waiting` — nothing to do; waiting on the reviewer.
- `pending` — the agent hasn't judged it yet ("no feedback yet", a dashed chip).
- `praise` — positive feedback; no action.
- `error` — the agent couldn't classify it; *Open in terminal*.

### Branch health (PR-level, separate from threads)

- `conflict` — the agent is auto-rebasing → renders **AgentWorking** (In
  progress); no manual button.
- `surfaced` — the agent bailed on a risky rebase → *Show details* + *Open in
  terminal* (Needs you).
- `outofsync` — the branch diverged and the agent never ran → *Resolve in
  terminal* (Needs you).

There is no manual "rebase" button — rebasing is part of the agent's single run.

### JIRA / compliance

If a PR's title is missing a ticket key, the compliance check fails and a
**JiraBanner** appears in the Needs-you lane. Setting a ticket key clears it.

---

## The controller contract

The compositions are **controlled** — they take a single `controller` object that
owns thread / branch / cart / JIRA state. The reference implementation is the
`makeController()` method in `PR Controller.dc.html`'s logic class (the
equivalent of the original app's `useDashboard` hook), backed by the `ts` / `bs`
/ `jira` / `runs` state maps.

| Method | Purpose |
| --- | --- |
| `approveApproach(id)` / `unstageApproach(id)` / `approachStaged(id)` | Stage / unstage / read a thread's suggested approach into the PR cart. |
| `sendReply(id, text)` / `undoReply(id)` / `replySent(id)` / `replyText(id)` | Send / undo / read the suggested reply to a reviewer. |
| `discuss(id)` / `threadTerminalOpen(id)` | Open a terminal session for a thread; read its open state. |
| `branchDetailsOpen(prId)` / `toggleBranchDetails(prId)` | Show/hide a surfaced-rebase's details. |
| `branchTerminal(prId)` / `branchTerminalOpen(prId)` | Open a terminal for a branch-level action; read its state. |
| `jiraValue(prId)` / `setTicket(prId, value)` | Read the linked ticket; set a ticket key (returns `false` if empty). |
| `stagedCount(prId)` / `running(prId)` / `runAgent(prId)` | Count staged approaches; whether a run is live; fire one agent run for the whole cart. |

The **StagedApprovalsBar** is the per-PR cart CTA: **Run agent (N)** fires one
worker carrying every approach you've staged.

---

## domain → tone dictionary (THIS workspace onto the foundation)

The foundation's primitives take **abstract tones**. The original PR-Controller
named tones by product meaning/color. This workspace translates **product
meaning → foundation tone** wherever it passes a tone to a primitive:

| product meaning | original name | foundation tone | where |
| --- | --- | --- | --- |
| needs you / urgent | `accent` / `urgency` | **`urgent`** | needs-input tag, CI pill, missing-ticket / branch chips, seal |
| agent did / agent working | `sage` / `agent` | **`active`** | agent-fixed tag, AgentWorking, conflict rebase, Approved badge |
| waiting on reviewer | `neutral` / `quiet` | **`neutral`** | waiting tag, Review-required badge, behind-base pill |
| not yet judged | `pending` | **`pending`** | a thread the agent hasn't classified (dashed chip) |
| positive review | `praise` | **`praise`** | praise thread |
| agent error | `ochre` / `error` | **`error`** | a failure the agent couldn't classify |
| draft / de-emphasized | `outline` | **`outline`** | Draft review badge |

`AgentWorking` is the single home for the "agent is live on this PR" semantic —
it wraps the foundation **Callout** in the `active` tone with an **OrganicLoader**
(`ripple`). Both the PRCard `agentWorking` row and BranchStatus `conflict` render
through it.

---

## Content voice

- **Calm, plain, precise.** Short declaratives. The tool defers to you; it never
  hypes.
- **Person:** the user is **you** ("Resolve these before the agent continues.");
  the automation is **the agent** ("applied by the agent").
- **Casing:** sentence case in prose and buttons. Tags/pills are the exception —
  lowercase, uppercased *visually* via CSS tracking.
- **Status, not alarm:** failures are stated flatly ("CI failing: unit-api"). No
  exclamation, no red sirens.
- **Confirmations** lead with `✓` and name the actor ("✓ Reply sent to the
  reviewer."). Reversible actions offer **Undo**.
- **Reasons:** every agent classification carries a one-line rationale prefixed
  `↳`; the full rationale is revealed on demand ("Show agent's reasoning").
- **Numerals:** spare — counts and code identifiers only.
- **Punctuation:** middot `·` separates peers; `↳` introduces a reason; `›_`
  marks a terminal hand-off.
- **No emoji.** The only glyphs are functional: `⟳` refresh · `↳` reason ·
  `◆` compliance/JIRA · `›_` terminal · `✓` done, plus CSS-shape status dots.

---

## Pointer to the foundation

For all visual language and the primitive APIs, see the bound Wabi-Sabi design
system. Primitives used by this workspace, imported from
`window.DesignSystem_220c99`: **Button, TextButton, Badge, DispositionTag,
Callout, Toast, Confirmation, EmptyState, Skeleton, OrganicLoader, Tabs,
ScopeBadge, ThemeSwitcher**. (TerminalNote is product-owned — see CLAUDE.md.)
