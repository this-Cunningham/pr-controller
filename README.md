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
│      • fixes CI caused by this PR; rebases on any merge conflict; surfaces if hairy
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
- **Rebase on any merge conflict, regardless of approval.** A conflict blocks merge
  no matter the review state, so the agent auto-rebases when one appears (clean →
  `--force-with-lease`; hairy → surface). CI fixes anytime.

## Scope (`config.onlyPRs`)

`config.onlyPRs` scopes the daemon's blast radius. It's an allowlist of
`repo#number` keys:

- **Empty `[]`** → all of your open PRs (full production).
- **A list** (e.g. `['site-vdp-remix#835']`) → ONLY those PRs are scanned,
  rendered, and worked; everything else is invisible to the daemon.

This is both the hardening sandbox (point it at one throwaway PR and exercise the
real push/comment/resolve/rebase paths) and a permanent prod circuit-breaker.
There is no separate dry-run mode — the worker always executes for real on the PRs
it can see.

## Run

```
node server.mjs        # then open http://localhost:4317
```

Requires `gh` authenticated against the enterprise host (see `config.host`).

## Dashboard (React)

The UI is a Vite + React app in `pr-controller-react/` (design system is the
source of truth; do not restyle the components ad hoc). The backend is the single
source of truth for both data AND routing — the daemon (`placements.mjs`) emits a flat
`placements` list assigning each item to a lane. `pr-controller-react/src/adapt.js`
(`buildLanes`) only FILTERS those placements into lanes and maps each disposition to the
design system's tag vocabulary; it derives no routing. The card (`PRCard`) is a pure
renderer of the items it's handed. See [ARCHITECTURE.md](ARCHITECTURE.md).

- **Develop:** `cd pr-controller-react && yarn && yarn dev` — Vite serves on 5173
  and proxies `/state.json` + `/decision` to `server.mjs` on 4317 (run the backend
  too). Hot-reload for design work.
- **Production:** `yarn build` → `pr-controller-react/dist/`. `server.mjs` serves the
  built app at http://localhost:4317 (it returns a "build the dashboard first" notice
  until `dist/index.html` exists).

Action buttons POST to `/decision`; `note`/`set-jira`/`discuss` act on the backend
(`gh` reply, title edit, terminal), and every decision is also recorded to
`data/decisions.json`.
