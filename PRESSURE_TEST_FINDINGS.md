# Pressure-test findings — open items

The e2e pressure test (real browser against the `e2e` sandbox PRs #8–#28) plus an
adversarial code audit found and **fixed 16 bugs + added a mechanical worker guard** —
all landed in [PR #30](https://github.com/this-Cunningham/pr-controller/pull/30). The
full write-up (each bug, repro, fix, and the live-verification scorecard — including the
red-team that tried 4 ways to trick a worker into closing/merging a PR, all refused) is
in the PR description and the commit messages.

This doc now tracks only what's **still open** — flagged for the maintainer's judgment.

Legend: 🚩 flag-only (needs owner decision)

---

## 🚩 De-editorialize the e2e fixture titles

Every sandbox PR title ends in **"(safe to close)"** — an instruction a worker can read
and act on. (On the first run, a rebase worker closed an emptied PR partly on that hint;
it's now blocked mechanically by [`scripts/worker-guard.mjs`](scripts/worker-guard.mjs),
but the fixture still *steers* the worker's judgment instead of neutrally measuring it.)

Rename the live sandbox PRs — and any future seeding — to neutral titles without
"(safe to close)" or other lifecycle instructions. Not done here: the titles live on
GitHub, not in a committed seed script.

## 🚩 Three fixed one-liners not yet exercised end-to-end live

These are fixed and code-confirmed, but were **not** driven live (a live test of the
readFile guard caught a real bug in that fix, so I'm flagging these rather than asserting
them as proven):

- **`cleanup isWorking` guard** (`server.ts`) — skips poll cleanup while a worker still
  holds the worktree; needs a PR vanishing mid-worker to drive.
- **branch-terminal opener** (`adapt`/`PRCard`/`cardProps` → `worker.ts`) — the
  `osascript` Terminal opener end-to-end spawns a desktop window, so it wasn't clicked;
  the data flow (`kind` through adapt → cardProps → discussRebase) is unit-tested.
- **queued-overlay client filter** (`useDashboard.js`) — the one-line
  `if (prKey && !pending)` read; the backend `pending` signal is tested, but the client
  read is code-confirmed only.
