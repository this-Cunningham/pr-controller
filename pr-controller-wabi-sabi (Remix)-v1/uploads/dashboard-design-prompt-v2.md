# PR Controller — design-tool prompt (v2)

Paste the block below into Claude design (or similar). It describes UI structure,
data, states, and interactions; the aesthetic direction is stated up front and
applied throughout. Element names/states mirror the live `state.json` + per-item
routing so generated assets map back onto real data with minimal glue.

This supersedes `design-system/uploads/dashboard-design-prompt.md` — the model has
since moved to per-ITEM tab routing, a renamed disposition vocabulary, a scope
(not safe-mode) badge, agent-drafted recommendations, and an auto-rebase flow.

---

**Project: PR Controller dashboard**

**Aesthetic direction.** Modern, clean, refined, intuitive, with elements of
**wabi-sabi** — the Japanese philosophy (rooted in Zen) that finds beauty in
imperfection, transience, and natural simplicity: uncluttered space, raw organic
materials, an appreciation for how things age and settle. In practice for this UI:
generous negative space, a warm earthy "stone" palette (muted clay/terracotta
accent, sage greens, ochre, ink-on-warm-paper), restrained type, soft natural
edges over hard chrome, and calm by default — urgency is signaled sparingly so the
one thing that needs a human stands out. Support a light ("warm paper") and dark
("stone") theme from the same tokens. Color/type/spacing live in a token layer
(accent / sage / neutral / praise / ochre / pending tones; a spacing + radius +
type scale), not hardcoded per element.

Design the UI for a single-screen local dashboard that monitors a developer's open
pull requests and shows what an automated agent is doing with each one. The agent
polls all the user's open PRs every ~30 minutes, automatically addresses
straightforward reviewer feedback (fixes code, replies `fixed`, leaves the thread
open for the reviewer to confirm), fixes CI, and rebases merge conflicts — but
**surfaces anything that needs the user's judgment.** The dashboard's core job:
**make the items that need the user obvious and actionable, while keeping
everything the agent is handling glanceable.** It is read-mostly with a few inline
action controls; there is no navigation — one page that auto-refreshes (and gets
live "agent working" nudges over a push channel).

**Core mental model — the unit is the ITEM, not the PR.** A single PR can have one
thread that needs the user AND another the agent already fixed AND a merge conflict
the agent is rebasing — each is a separate *item* that routes to its own tab. So
**one PR can appear in more than one tab at once**, each card showing only that
tab's slice of items.

Design these elements:

**1. Header bar**
- App title.
- A **scope badge** (NOT a safe/live toggle): the agent always acts for real on the
  PRs it can see. The badge shows whether it's watching **all** your open PRs, or is
  **scoped** to a specific allowlist of PRs (e.g. "Scoped · 3 PRs"). Two visual
  states: "all PRs" vs "scoped to N".
- A summary line: total open PRs, how many "need you", a last-updated timestamp.
- A manual refresh control.

**2. Three tabs (priority order; a PR may appear in several)**
- **① Needs you** — items requiring a user action. Caption: "Resolve these before
  the agent continues." Emphasis treatment (see card).
- **② In progress** — items the agent is actively working (or queued to). Calm card
  **with a quiet pulsing "agent working" cue**. Caption: "The agent is working on
  these — just glance."
- **③ Waiting on reviewer** — the agent (or you) acted; the next move is the
  reviewer's. Calm, informational. Caption: "Addressed — waiting on the reviewer."
- Each tab has a label, a count, and an empty state (the calm ensō / "Nothing needs
  you right now." etc.).

**3. PR card** (the repeating unit inside a tab — renders only that tab's items)
- PR identifier (repo + number) as a link, and the PR title.
- A review-status pill: `APPROVED`, `REVIEW_REQUIRED`, `DRAFT`.
- Optional signal pills (In-progress branch work): "behind base", "CI failing:
  <check names>".
- **Card emphasis is per-tab:** the card is emphasized (accent left-rule + a small
  seal/dot, top-right) ONLY in its Needs-you appearance; the same PR's slice in
  In-progress / Waiting is calm.
- A pulsing **"Agent working"** callout when the agent is on this PR (In-progress).
- Contains zero or more thread rows for that tab, plus optional banners (below).
- "No open threads — waiting on the reviewer." empty-body line when a slice has none.

**4. Thread row** (a single reviewer comment thread inside a card)
- A **disposition tag** (the agent's verdict). Vocabulary + tone:
  - `needs your input` (accent) — the agent surfaced this for your judgment.
  - `agent fixed · waiting on reviewer` (sage) — fixed in code, replied `fixed`,
    left open for the reviewer.
  - `waiting on reviewer` (neutral) — you replied; ball is the reviewer's.
  - `no feedback yet` (pending — a faint **dashed** chip) — the agent hasn't judged
    it yet (queued / in flight).
  - `praise` (praise tone) — the agent reacted 🎉; shown in no tab normally.
  - `agent error` (ochre) — the agent couldn't classify a scan/run failure.
- File location (`path:line`) and the comment author handle.
- The comment body (can be long/multi-line → clamp to a few lines + "Show more").
- A **collapsible "agent's reasoning"** caption (one-line summary by default;
  "↳ Show agent's reasoning" reveals the full rationale — it can be a paragraph).
- Action controls vary by tag:
  - **needs your input:** the row can carry up to two agent-drafted aids —
    - a **"Suggested approach"** callout with an **"Approve approach"** button
      (approving STAGES it into a per-PR cart; a "Run agent (N)" control then fires
      ONE worker to carry out everything staged). To change the approach, the user
      uses "Discuss in terminal" rather than editing it inline.
    - a **"Suggested reply"** that PRE-FILLS the rebuttal textarea (editable);
      "Send reply" posts it to the reviewer.
    - plus a "Discuss in terminal" button (opens an interactive session).
  - **agent fixed / waiting / praise:** no actions — a "no action needed / waiting
    on the reviewer to confirm" caption.
  - **no feedback yet:** no action — "the agent is reviewing this now…" /
    "hasn't reviewed yet".
  - **agent error:** an "Open in terminal" button.

**5. Branch-health states** (PR-level, not a thread)
- **Merge conflict** → the agent rebases as part of its single run. Show an
  INFORMATIONAL, pulsing **"Resolving merge conflict — the agent is rebasing this;
  if it can't resolve safely it'll surface it for you."** (In progress). No manual
  rebase button.
- **Agent surfaced** (the agent tried the rebase / hit a judgment call and bailed) →
  a calm **one-line** urgency callout ("Rebase too risky to do automatically — open
  a terminal to continue."), a **"Show details"** expander for the full reason, and
  an **"Open in terminal"** button. (Needs you.)
- **Branch out of sync** (diverged from remote; the agent never ran) → an urgency
  callout + **"Resolve in terminal"** button. (Needs you.)
- **Every Needs-you item offers an "open in terminal" escape hatch.**

**6. JIRA-needed banner** (on a card when a compliance check fails for a missing
ticket) — short explanation + a ticket-key text input (placeholder `ABC-123`) + a
"Set ticket" button; collapses to a confirmation once linked. (Needs you.)

**7. States to cover across the design**
- Loading / first-fetch (skeleton).
- Empty tab (the calm ensō empty state).
- A PR with many threads (dense, scrolling bodies) vs. a PR with none.
- Scope badge: "all PRs" vs "scoped to N".
- "Agent working" live state (pulsing cue) on an In-progress card.
- An action just taken — a confirmation/acknowledgment after approving an approach,
  sending a reply, setting a ticket, or opening a terminal ("›_ Terminal session
  opened…").
- A single PR shown simultaneously across tabs (a surfaced thread in Needs you, a
  fixed thread in Waiting, a conflict resolving in In progress).

Deliver these as reusable components (header + scope badge, tab bar, PR card, thread
row, disposition tags, review/signal pills, the branch-health states, JIRA banner,
the suggested-approach + suggested-reply control variants, terminal note,
empty/skeleton states) plus one assembled full-screen view showing all three tabs
populated — including at least one PR that appears in more than one tab.
