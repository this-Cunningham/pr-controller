# PR Controller — design-tool prompt

Paste the block below into Claude design (or similar). It describes UI structure,
data, states, and interactions only — look-and-feel (color, type, spacing) is left
out intentionally and applied separately. Element names/states mirror the live
`state.json` shape so generated assets map back onto real data with minimal glue.

---

**Project: PR Controller dashboard**

Design the UI for a single-screen local dashboard that monitors a developer's open
pull requests and shows what an automated agent is doing with each one. The agent
polls all the user's open PRs every 30 minutes, automatically addresses
straightforward reviewer feedback (fixes code, replies, resolves threads), fixes
CI, and rebases — but surfaces anything that needs the user's judgment. The
dashboard's core job: **make the PRs that need the user's attention obvious and
actionable, while keeping the rest glanceable.** It is read-mostly with a few
inline action controls; there is no navigation, it's one page that auto-refreshes.

Design these elements:

**1. Header bar**
- App title.
- A status/mode badge indicating whether the system is in a safe/paused state vs.
  live-acting (two visual states: "safe — no actions taken" and "live").
- A summary line with counts: total open PRs, how many "need you", and a
  last-updated timestamp.
- A manual refresh control.

**2. Three stacked sections (priority order, top = most urgent)**
- **① Needs you** — PRs with something the user must resolve.
- **② Auto-handling** — PRs the agent is fixing on its own; user just glances.
- **③ Waiting on reviewer / no action** — informational, lowest priority.
- Each section has a header and a count, and an empty state ("nothing flagged").

**3. PR card** (the repeating unit inside sections)
- PR identifier (repo + number) as a link, and the PR title.
- A review-status pill with distinct states: `APPROVED`, `REVIEW_REQUIRED`, `DRAFT`.
- Optional status pills that may appear together: "N auto-fixable", "behind base",
  "CI failing: <check names>".
- A card-level emphasis state for "needs you" (visually distinct from calm cards).
- Contains zero or more thread rows, and optionally a JIRA banner (below).

**4. Thread row** (a single reviewer comment thread inside a PR card)
- A disposition tag with these states: `DISAGREE / hash-out` (needs user),
  `agree-fix` (auto), `waiting-reviewer`, `praise`, `error`.
- File location (`path:line`) and the comment author handle.
- The comment body text (can be long/multi-line; needs truncation or scroll).
- A one-line "reason" caption explaining the agent's classification.
- Action controls that vary by tag:
  - **hash-out:** a "Discuss in terminal" button **and** a free-text rebuttal input
    where the user types why they disagree.
  - **agree-fix:** "Approve fix" and "Skip" buttons.
  - **waiting/praise:** no actions (just a "no action needed" caption).

**5. JIRA-needed banner** (appears on a PR card when a compliance check fails for a
missing ticket)
- A short explanation that the PR title lacks a ticket.
- A small text input for a ticket key (placeholder like `ABC-123`) and a "Set
  ticket" button.

**6. States to cover across the design**
- Loading / first-fetch.
- Empty section.
- A PR with many threads (dense) vs. a PR with none.
- The "safe mode" vs "live" global state.
- An action just taken (e.g. a confirmation/acknowledgment after clicking a button
  or submitting an input).

Deliver these as reusable components (header, section, PR card, thread row, status
pills, JIRA banner, the two action-control variants) plus one assembled full-screen
view showing all three sections populated.
