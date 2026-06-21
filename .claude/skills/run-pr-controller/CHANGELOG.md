# Changelog — run-pr-controller

## 1.0.0 — 2026-06-21

Initial skill. Authored by launching and driving the actual running app.

Drives the **real daemon** via the built-in **`dev` profile** (`PRC_PROFILE=dev` in
[config.mjs](../../../config.mjs)) — a first-class config profile that points
host/owner/login at a **whitelist of disposable `[e2e] … safe to close` PRs on
personal github.com** (`this-Cunningham/pr-controller` #1–3). Runs the full
scan/derive/place/render/**dispatch** pipeline against real GitHub data, scoped by
`config.onlyPRs` so real `claude -p` workers only ever touch the sandbox, never
prod. Running the app means real workers run; the safety boundary is which PRs they
touch, not "no workers." The startup banner now prints `[<profile> @ <host>]`.

The client-side `/state.json` fixture is **not** part of this skill — it's a
UI-check tool, relocated to `pr-controller-react/dev/inject-demo-state.js` for
eyeballing the React components in every disposition state with no daemon. (It was
never coupled to the daemon; an earlier crash I attributed to "fixture mode" was an
independent daemon bug — `recordDecision` writing `data/decisions.json` without
`mkdir` — that only surfaces when the first poll never succeeds, so `data/` is
never created. The whitelist path's first poll succeeds and creates `data/`.)

Verified:

- Built `pr-controller-react/dist/`, ran the 96-test suite (pass), launched
  `server.mjs` scoped to `pr-controller#1`, confirmed it scans real GitHub data
  (`[poll] 1 PRs`) and serves http://localhost:4317 — with **no `claude -p` worker
  dispatched** (scope #1's threads are `awaitingReviewer`).
- Drove the live dashboard via `chrome-devtools` (navigate → click lane →
  screenshot); confirmed real e2e PR #1 + its 3 review threads render in the
  Waiting lane.
- Added `smoke.sh` (build → safe whitelist launch → wait for scan → click populated
  lane → screenshot → verify → stop), with `KEEP=1` for interactive driving and a
  `SCOPE=` override for the worker-dispatching hardening sandbox (#2/#3).
- Captured gotchas: `config.onlyPRs` as the only safety boundary, first-poll =
  first-dispatch (#2/#3 spawn workers), the `PRC_POLL_MINUTES` → `setInterval`
  32-bit overflow (clamps to 1 ms), config read-once-at-load, and the render/scan
  race when clicking lanes.

### smoke.sh fixes made while authoring
- `set -e` + `pipefail`: `grep -o` exits 1 on zero matches, aborting the script
  mid-startup — swallowed with `|| true`.
- Lane-click raced the React render; added a retry loop until a populated lane
  button exists.
