# pr-controller

A local daemon + dashboard that watches all of your open PRs across the
enterprise, and dispatches a headless Claude worker per PR to address reviewer
feedback, fix CI, and rebase — while surfacing anything that needs your judgment.

## How it works

```
node server.mjs (one persistent process on your awake laptop)
│
├─ every 30 min: POLL (pure Node + gh, no Claude)
│    gh search prs --author @me --state open      → all your open PRs
│    GraphQL per PR: review threads + mergeable + CI rollup
│    diff vs last poll → which PRs changed (threads, behind-base, CI)
│
├─ for each CHANGED pr: dispatch a headless worker
│    claude -p  (--session-id first time, --resume after) in a per-PR worktree
│      • first run: familiarizes itself with the PR diff (remembered on resume)
│      • addresses new review threads (lean toward fix; surface disagreements)
│      • fixes CI caused by this PR; rebases if approved; surfaces if hairy
│
└─ serves a dashboard (http://localhost:4317)
     PRs needing YOUR input float to the top:
       - disagreements (Discuss-in-terminal + rebuttal box)
       - missing JIRA ticket (input box → prepends [TICKET] to title)
       - conflicts / unrelated CI failures
```

## Key design decisions

- **Per-PR durable session.** Each PR gets one Claude session, resumed across
  rounds, so it remembers the PR. Volatile state (the branch) is always
  re-grounded via `git pull --ff-only` + `git diff <since>..HEAD`.
- **Reuses your existing clones.** Discovers clones under `~/cargurus` by git
  remote (not dir name), adds worktrees off them. Clones only if not found.
- **Never disturbs in-progress work.** If the PR branch is checked out dirty
  somewhere, uses a `--detach` worktree at the branch tip — no stashing.
- **Lean toward auto-fix**, but surface (never act on) anything that would be a
  bug, contradicts a deliberate design choice, is out of scope, or needs a
  product decision. Never edits a test to make it pass.
- **Rebase only when approved.** CI fixes anytime; rebase waits for approval.

## SAFE_MODE

`config.SAFE_MODE` (default `true`) is the master kill-switch. While on: workers
are NOT spawned, nothing is pushed, no comments posted, no titles edited, no
threads resolved — the poller only classifies and the dashboard renders. Flip to
`false` only once the behavior is trusted.

## Run

```
node server.mjs        # then open http://localhost:4317
```

Requires `gh` authenticated against the enterprise host (see `config.host`).

## Dashboard (React)

The UI is a Vite + React app in `pr-controller-react/` (design system is the
source of truth; do not restyle the components ad hoc). The backend stays the
single source of data — `pr-controller-react/src/adapt.js` is the ONLY place that
reshapes `state.json` into the component prop shape.

- **Develop:** `cd pr-controller-react && yarn && yarn dev` — Vite serves on 5173
  and proxies `/state.json` + `/decision` to `server.mjs` on 4317 (run the backend
  too). Hot-reload for design work.
- **Production:** `yarn build` → `pr-controller-react/dist/`. `server.mjs` detects
  `dist/index.html` and serves the built app at http://localhost:4317 (falling back
  to the legacy `dashboard.html` if no build exists).

Action buttons POST to `/decision`; `set-jira`/`discuss` act on the backend (gated
by `SAFE_MODE`), the rest are recorded to `data/decisions.json`.
