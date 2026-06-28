---
name: run-pr-controller
version: 1.1.0
description: >-
  Build, launch, screenshot, and drive the pr-controller daemon + React dashboard
  locally and SAFELY against whitelisted dummy PRs on personal github.com (no
  production PRs touched). Use when asked to run / start / serve / screenshot /
  verify / drive the pr-controller app or its dashboard, or to QA a UI / lane /
  placement change in the running app.
---

# Run pr-controller

pr-controller is a local Node daemon (`server.ts`) that serves a Vite + React dashboard
from `pr-controller-react/dist/` at **http://localhost:4317**, polling your open GitHub PRs
and dispatching headless `claude -p` workers that push to them. The driver is the one-shot
harness [`.claude/skills/run-pr-controller/smoke.sh`](.claude/skills/run-pr-controller/smoke.sh)
(build → launch → **arm polling** → scan → screenshot), plus the `chrome-devtools` CLI for
interactive driving.

> **Paths below are relative to the repo root** (the `<unit>`) — `cd` there first.
> **Config note:** config comes from your gitignored `config.local.json` (or `PRC_*`) — run
> `/configure-pr-controller` if it's missing. `PRC_PROFILE=dev` selects the sandbox profile.

By default ([config.ts](config.ts)) a bare `node --import tsx server.ts` targets the **configured
prod** host — which you do **not** want locally. The safe path is the **`dev` profile**: it
scopes to a whitelist of disposable `[e2e] … safe to close` PRs on personal github.com
(`this-Cunningham/pr-controller#1–3`). `config.onlyPRs` is the circuit-breaker — every PR
outside the whitelist is invisible. This runs the **real** pipeline (scan → derive → place →
render → dispatch real workers) against **real** GitHub; the safety boundary is *which PRs*
they touch (the sandbox), never "no workers."

> **Just want to eyeball the UI?** This skill runs the *app*. For pure component checks in
> every disposition state — no daemon, no GitHub, no workers — use the client-side fixture
> [`pr-controller-react/dev/inject-demo-state.ts`](pr-controller-react/dev/inject-demo-state.ts).
> It's written as the JS∩TS subset, so inject it raw: `--initScript "$(cat dev/inject-demo-state.ts)"`.

## Prerequisites

- **Node ≥ 18, Yarn 1.x** (verified Node v22.12.0, Yarn 1.22.22).
- **`chrome-devtools` CLI** on PATH (the `chrome-devtools-mcp` plugin) — drives + screenshots headlessly.
- **`gh` authed on github.com** as the whitelist owner (`this-Cunningham`):
  `gh auth status` → `Logged in to github.com account this-Cunningham`. The daemon shells out to `gh` per scan.
- The sandbox PRs must be open: `gh pr list --repo this-Cunningham/pr-controller --state open` → #1–3.

## Build

The server returns **503 "Dashboard not built"** until `dist/index.html` exists:

```bash
cd pr-controller-react && yarn install --silent && yarn build && cd ..
# -> pr-controller-react/dist/index.html
```

## Run (agent path) — one command

```bash
.claude/skills/run-pr-controller/smoke.sh
```

Builds `dist/` if missing, launches the daemon scoped to `pr-controller#1`, **arms polling**,
waits for the real GitHub scan, clicks the populated lane, screenshots to
`/tmp/prc-dashboard.png`, verifies ≥1 PR scanned, stops. Prints `[smoke] PASS`. (#1 is
display-only — its threads are `awaitingReviewer`, so it dispatches no worker.)

- **Keep it up to drive interactively:** `KEEP=1 .claude/skills/run-pr-controller/smoke.sh`
  (leaves the server on :4317; stop with `pkill -f 'server.ts'`).
- **Override** scope / port / screenshot:
  `SCOPE="pr-controller#1,pr-controller#2" PORT=4400 SHOT=/tmp/x.png .claude/skills/run-pr-controller/smoke.sh`.
- **Run it for real (workers dispatch against the sandbox):** widen to
  `SCOPE="pr-controller#1,pr-controller#2,pr-controller#3"`. #2 (`@claude-debug` trigger) and
  #3 (merge conflict) spawn real `claude -p` workers that push/rebase those disposable PRs on
  the first armed poll. Slower (minutes); watch `/tmp/prc-server.log` for dispatches.

### Drive it by hand

```bash
# 1. Launch the daemon in the dev sandbox, scoped to one PR. Banner shows the blast radius.
PRC_PROFILE=dev PRC_ONLY_PRS="pr-controller#1" PRC_POLL_MINUTES=1440 PRC_PORT=4317 \
  node --import tsx server.ts > /tmp/prc-server.log 2>&1 &
# 2. ARM POLLING — the daemon starts OFF and won't scan/dispatch until you do this.
curl -fsS -X POST http://localhost:4317/polling -H 'content-type: application/json' -d '{"on":true}'
# 3. After a few seconds, real data lands:
curl -s http://localhost:4317/state.json   # scope + prs[] + placements[]

# 4. Drive the dashboard — live /state.json, real cards/lanes, no fixture:
chrome-devtools navigate_page --url "http://localhost:4317"
chrome-devtools take_snapshot                          # element uids (lane tabs, buttons)
chrome-devtools click <uid>                            # e.g. the "Waiting on reviewer N" lane
chrome-devtools take_screenshot --filePath /tmp/prc.png
```

The three lane tabs (Needs you / In progress / Waiting on reviewer) are the
server-authoritative placements filtered client-side — clicking them is the fastest way to QA
a `placements.ts` change. Stop with `pkill -f 'server.ts'`.

## Direct invocation (most PRs need only this)

The routing / verdict / derivation core is pure and I/O-free (`placements.ts`, `rules.mjs`,
`derive.mjs`, `adapt.js`) and locked by tests. A PR touching those is verified without launching:

```bash
node --import tsx --test "test/**/*.test.ts"     # 168 tests, ~0.3s
```

Run the test suite first; only build + launch the app for UI / lane / rendering work.

## Run (human path) — REAL prod, touches live enterprise PRs

```bash
node --import tsx server.ts        # then open http://localhost:4317, toggle polling ON in the header
```

⚠️ A bare `node --import tsx server.ts` (no env) uses `config.local.json`'s top-level `profile` — or the
built-in `prod` if unset. If that resolves to a prod-type profile with **empty `config.onlyPRs`**,
arming polling means it **scans ALL your open PRs and spawns real workers that push/comment/rebase**.
The startup banner shows `[<profile> @ <host>]` and the daemon warns when unconfigured + unscoped.
There is no dry-run — `config.onlyPRs` is the only circuit-breaker.

## Test

```bash
node --import tsx --test "test/**/*.test.ts"     # pure layers — 168 pass
cd pr-controller-react && yarn lint  # design-system token/prop adherence — 0 errors (2 known no-view-model-prop warnings)
```

## Gotchas

- **Polling is OFF on startup.** The daemon logs `polling is OFF by default — turn it on from
  the dashboard` and does NOTHING until armed via `POST /polling {"on":true}` (or the header
  toggle). `state.json` stays `"prs":[]` until then. `smoke.sh` arms it; a bare launch does not.
- **`config.onlyPRs` is the only safety boundary** — no dry-run flag. Empty `PRC_ONLY_PRS=""`
  means **ALL** your open PRs (full prod), the opposite of safe. Always scope locally.
- **First armed poll = first dispatch.** On startup `seen` is empty, so every dispatchable
  thread counts as "new." Scope #1 dispatches nothing (`awaitingReviewer`); **#2** (`@claude-debug`
  → synthetic reviewer → feedback worker) and **#3** (`needsRebase` → rebase worker) spawn real
  workers on the first armed poll — against the sandbox, by design.
- **Launch the daemon in a persistent shell.** `node --import tsx server.ts &` as a child of a transient
  wrapper shell gets reaped when that shell exits. `smoke.sh` keeps its own shell alive; for
  manual runs use an interactive shell or `nohup`.
- **`PRC_POLL_MINUTES` overflows `setInterval`.** `pollMinutes*60_000` must stay < 2,147,483,647 ms.
  A value like `99999` → Node clamps the interval to **1 ms** and the log floods with
  `[poll] already running, skipped`. Use `1440` (what `smoke.sh` does).
- **Config is read once at module load.** Set `PRC_*` *before* `node --import tsx server.ts`; no runtime host switch.
- **Dashboard 503 before build.** `GET /` returns `503 Dashboard not built` until `dist/index.html` exists.
- **Render races the scan.** After `navigate_page` the app fetches `/state.json` and renders
  lane counts a beat later — retry before clicking a lane by name (`smoke.sh` retries ~4s).

## Troubleshooting

| Symptom | Cause → Fix |
|---|---|
| `[smoke] FAIL — no PRs scanned` | Polling not armed, `gh` not authed on github.com as the owner, or sandbox PRs closed. `gh auth status`; `gh pr list --repo this-Cunningham/pr-controller --state open`. |
| `/state.json` shows `"prs":[]` after several seconds | Polling is OFF (arm it), the scope matched no open PR (typo in `PRC_ONLY_PRS`), or `gh` can't reach the host. Check `/tmp/prc-server.log` for `[poll] failed`. |
| `GET /` → `503 Dashboard not built` | No `dist/`. Run the Build step (`yarn build`). |
| Daemon vanished right after launch | Launched as a child of a transient shell (see Gotchas) — relaunch in a persistent/interactive shell or `nohup`. |
| Screenshot shows empty "Needs you" lane | Lane-click raced the render — retry after a short sleep (see Gotchas). |
| Log spams `[poll] already running, skipped` | `PRC_POLL_MINUTES` too large → 1 ms interval. Use `1440`. |
| `chrome-devtools: command not found` | Install the `chrome-devtools-mcp` plugin / put its CLI on PATH. |

---
_Improve this skill over time with `/auto-improve run-pr-controller` (see _changelog.json)._
