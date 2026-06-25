---
name: run-pr-controller
version: 1.0.0
description: >-
  Build, launch, screenshot, and drive the pr-controller daemon + React dashboard
  locally and SAFELY against whitelisted dummy PRs on personal github.com (no
  production PRs touched). Use when asked to run / start / serve / screenshot /
  verify / drive the pr-controller app or its dashboard, or to QA a UI / lane /
  placement change in the running app.
---

# Run pr-controller

> **Config note:** config comes from your gitignored `config.local.json` (or `PRC_*`) — run
> `/configure-pr-controller` first. `PRC_PROFILE=dev` in the examples below selects your `dev`
> profile; define it in config.local.json.

pr-controller is a local Node daemon (`server.mjs`) that serves a Vite + React
dashboard from `pr-controller-react/dist/` at **http://localhost:4317**. It polls
your open GitHub PRs and dispatches headless `claude -p` workers that push to those
PRs. By default ([config.mjs](config.mjs)) it targets the **configured enterprise**
host and real prod PRs — which you do **not** want for local runs.

The safe way to run it locally is the built-in **`dev` profile** (`PRC_PROFILE=dev`,
see [config.mjs](config.mjs)): it points host/owner/login at a **whitelist of
disposable `[e2e] … safe to close` PRs on personal github.com**
(`this-Cunningham/pr-controller` #1–3). `config.onlyPRs` is the circuit-breaker —
every PR outside the whitelist is invisible to the daemon. This runs the **real** daemon end-to-end (scan → derive →
place → render → **dispatch real `claude -p` workers**) against **real** GitHub
data. Running the app *means* real workers run — the safety boundary is **which
repo/PRs they touch** (the sandbox), never "no workers." They push/comment/rebase
the disposable sandbox PRs, never production.

The driver is the **`chrome-devtools` CLI** plus the one-shot harness
[`.claude/skills/run-pr-controller/smoke.sh`](smoke.sh).

> **Just want to eyeball the UI?** This skill runs the *app*. For pure visual /
> component checks of the dashboard in every disposition state — no daemon, no
> GitHub, no workers — use the UI-check fixture
> [`pr-controller-react/dev/inject-demo-state.js`](pr-controller-react/dev/inject-demo-state.js)
> (a client-side `/state.json` stub; see its header). That is **not** running the
> app and is not part of this skill.

> **Paths below are relative to the repo root** (the `<unit>`), not to this skill
> directory. `cd` to the repo root first.

## Prerequisites

- **Node ≥ 18** and **Yarn 1.x**. Verified on Node v22.12.0.
- **`chrome-devtools` CLI** on PATH (the `chrome-devtools-mcp` plugin) — drives and
  screenshots the dashboard headlessly.
- **`gh` authed on github.com** as the whitelist owner (`this-Cunningham`):
  `gh auth status` should show `Logged in to github.com account this-Cunningham`.
  The daemon shells out to `gh` for every scan.
- The whitelist PRs must still be open — `this-Cunningham/pr-controller` **#1**
  (`[e2e] placement-model demo`), **#2** (`@claude-debug trigger`), **#3**
  (`merge conflict`), all titled "safe to close". Check:
  `gh pr list --repo this-Cunningham/pr-controller --state open`.

## Build

The server returns **HTTP 503 "Dashboard not built"** until `dist/index.html`
exists, so build the React app first:

```bash
cd pr-controller-react && yarn install --silent && yarn build && cd ..
# -> pr-controller-react/dist/index.html
```

## Run (agent path) — one command

```bash
.claude/skills/run-pr-controller/smoke.sh
```

This is the **quick render smoke**: it builds `dist/` if missing, launches the
daemon scoped to `pr-controller#1` (display-only — its threads are
`awaitingReviewer`, so this scope happens to dispatch no worker), waits for the
real GitHub scan, clicks the populated lane, screenshots to `/tmp/prc-dashboard.png`,
verifies ≥1 PR was scanned, then stops. Fast, and proves the live pipeline renders.

- **Keep it running** to drive interactively: `KEEP=1 .claude/skills/run-pr-controller/smoke.sh`
  (leaves the server on http://localhost:4317; stop with `pkill -f 'node server.mjs'`).
- **Override** owner / scope / port / screenshot:
  `OWNER=… SCOPE="pr-controller#1" PORT=4400 SHOT=/tmp/x.png .claude/skills/run-pr-controller/smoke.sh`.
- **Run it for real (workers dispatch against the sandbox)** — what "run the app"
  means: widen the scope to `SCOPE="pr-controller#1,pr-controller#2,pr-controller#3"`.
  #2 (debug trigger) and #3 (merge conflict) dispatch real `claude -p` workers that
  push/rebase those disposable PRs. That's intended — they hit the **sandbox**, not
  prod. Slower (workers take minutes); watch `/tmp/prc-server.log` for dispatches.

### Drive it by hand

Launch the daemon in the `dev` profile, scoped to one PR (the same env `smoke.sh`
uses). The startup banner prints `[dev @ github.com]` so you can see the blast
radius at a glance:

```bash
PRC_PROFILE=dev PRC_ONLY_PRS="pr-controller#1" PRC_POLL_MINUTES=1440 PRC_PORT=4317 \
  node server.mjs > /tmp/prc-server.log 2>&1 &
# Wait a few seconds for the first scan, then:
curl -s http://localhost:4317/state.json    # real data: scope + prs[] + placements[]
```

Omit `PRC_ONLY_PRS` to use the profile's full sandbox scope (#1,#2,#3) — that runs
the real worker dispatch (see the agent-path bullets above).

Then drive the dashboard. This is **live** `/state.json` — real cards, real lanes,
no fixture:

```bash
chrome-devtools navigate_page --url "http://localhost:4317"
chrome-devtools take_snapshot                 # get element uids (lane tabs, buttons)
chrome-devtools click "2_21"                  # e.g. the "Waiting on reviewer N" lane
chrome-devtools take_screenshot --filePath /tmp/prc.png
```

The three lane tabs (`Needs you` / `In progress` / `Waiting on reviewer`) are the
server-authoritative placements filtered client-side — clicking them is the quickest
way to QA a `placements.mjs` change. Stop with `pkill -f 'node server.mjs'`.

## Direct invocation (most PRs need only this)

The routing / verdict / derivation core is pure and I/O-free — `placements.mjs`,
`rules.mjs`, `derive.mjs`, `adapt.js` — and locked by tests. A PR that touches
those layers is verified without launching anything:

```bash
node --test "test/**/*.test.mjs"     # 96 tests, ~70ms
```

Each pure module imports and calls cleanly, e.g.
`node -e "import('./placements.mjs').then(m => console.log(typeof m.placementsFor))"`.
Run the test suite first; only build + launch the app for UI / lane / rendering work.

## Run (human path) — REAL prod, touches live enterprise PRs

```bash
node server.mjs        # then open http://localhost:4317
```

⚠️ A bare `node server.mjs` (no env overrides) uses your `config.local.json` top-level
`profile` key — or the built-in `prod` if it's unset. If that resolves to a `prod`-type
profile with an **empty `config.onlyPRs`**, discovery (`gh search prs --author @me`) means it
**scans ALL your open PRs and spawns real `claude -p` workers that push/comment/rebase** — the
circuit-breaker is OFF. The startup banner shows `[<profile> @ <host>]` and the daemon warns when
it's running unconfigured + unscoped. There is no dry-run mode — `config.onlyPRs` is the only
circuit-breaker. Only run unscoped with `gh` authed and a scope you intend to act on.

## Test

```bash
node --test "test/**/*.test.mjs"                     # pure layers (rules/derive/placements/adapt/dispatcher)
cd pr-controller-react && yarn lint                  # design-system token + prop/tone adherence
```

## Gotchas

- **`config.onlyPRs` is the only safety boundary** — there is no dry-run flag. An
  empty `PRC_ONLY_PRS=""` means **ALL** your open PRs (full production), the
  opposite of safe. For local runs always scope to a known whitelist of disposable
  PRs.
- **First poll = first dispatch.** On startup `seen` is empty, so every dispatchable
  thread counts as "new." Scope `pr-controller#1` dispatches nothing (its threads are
  `awaitingReviewer`); **#2** (`@claude-debug` re-attributes your comment to a
  synthetic reviewer → feedback worker) and **#3** (`needsRebase` → rebase worker)
  spawn real workers on the first scan — against the sandbox, by design. Choose the
  scope by whether you want a quick render check (#1) or a real worker run (#2/#3).
- **`PRC_POLL_MINUTES` overflows `setInterval`.** `pollMinutes * 60_000` must stay
  under 2,147,483,647 ms (~35,790 minutes). A value like `99999` becomes
  `5,999,940,000` ms, Node clamps it to **1 ms**, and the log floods with
  `[poll] already running, skipped`. Use `1440` (1 day) — what `smoke.sh` does.
- **Config is read once at module load.** Set the `PRC_*` env vars *before*
  `node server.mjs`; there's no runtime/UI host switch (the "Scoped" button only
  changes which PRs are watched, not the host).
- **Render races the scan.** After `navigate_page`, the React app fetches
  `/state.json` and renders lane counts a beat later — wait/retry before clicking a
  lane tab by name (`smoke.sh` retries up to ~4s).
- **Dashboard 503 before build.** `GET /` returns `503 Dashboard not built` until
  `pr-controller-react/dist/index.html` exists. Build, then reload.

## Troubleshooting

| Symptom | Cause → Fix |
|---|---|
| `[smoke] FAIL — no PRs scanned` | `gh` not authed on github.com as the owner, or the whitelist PRs were closed. `gh auth status`; `gh pr list --repo this-Cunningham/pr-controller --state open`. |
| `GET /` → `503 Dashboard not built` | No `dist/`. Run the Build step (`yarn build`). |
| `/state.json` shows `"prs":[]` after a few seconds | The scope matched no open PR (typo in `PRC_ONLY_PRS`), or `gh` can't reach the host. Check `/tmp/prc-server.log` for `[poll] failed`. |
| Screenshot shows empty "Needs you" lane | The lane-click raced the render — retry after a short sleep (see Gotchas). |
| Log spams `[poll] already running, skipped` | `PRC_POLL_MINUTES` too large → 1 ms interval (see Gotchas). Use `1440`. |
| Daemon exits on first decision click while offline | Latent bug: `recordDecision` writes `data/decisions.json` without `mkdir`; only bites if the first poll never succeeded (so `data/` was never created). A successful scan creates `data/` and avoids it. |
| `chrome-devtools: command not found` | Install the `chrome-devtools-mcp` plugin / put its CLI on PATH. |

---
_Improve this skill over time with `/auto-improve run-pr-controller` (see _changelog.json)._
