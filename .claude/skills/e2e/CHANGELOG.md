# Changelog — e2e

## 1.1.0 — 2026-06-25

Reworked from feedback + a 4-dimension adversarial audit of v1.0.0 against the code
(15 actionable findings; blockers fixed).

- **Arg is now free text** — `<what to test>` describes the part of the app/behavior to
  exercise; it steers both PR selection and the manual UI testing.
- **Visible browser, watched live.** Drive in a real headed Chrome; arm the daemon via
  the dashboard's header toggle so the user watches the scan + dispatch happen.
- **Blocker fix — the daemon is idle until armed.** Verified live: `node server.mjs`
  starts with `pollingEnabled:false` and `prs:[]`; only `POST /polling {on:true}` (or the
  dashboard toggle) triggers the first scan (`server.mjs` listen handler; `startPolling`).
  v1.0.0's "launch → it scans" was wrong. (Likely a latent regression in
  `run-pr-controller`'s `smoke.sh`, which doesn't arm — flagged separately.)
- **Realistic fixtures.** New PRs use real-looking titles/branches/bodies — no `[e2e]`,
  no "safe to close" (a known worker steer per PRESSURE_TEST_FINDINGS.md); injected
  comments read like real reviewers (token appended, not leading).
- **Manual UI testing.** Added "drive the app like a real user" — click lanes, CTAs,
  Settings/sensitivity, per the run's ask.
- **`reset-prs.sh`** — clears the fleet before a run: `resolve` (safe/reversible — daemon
  sees a clean slate) or `--hard` (delete review + issue comments). Verified the
  resolve↔unresolve roundtrip live on `#8`.
- **`inject-debug.sh` fixes** — now targets an **unresolved** thread's root via GraphQL
  (REST `pulls/N/comments` can't tell resolved from open, so v1.0.0 could reply to a
  resolved thread → silent no-op), and surfaces real gh API errors instead of swallowing
  the error JSON into the comment id.
- **Fleet table reframed** as *designed* scenarios (by branch family) to verify with the
  read-only scan, since fixture state drifts. Corrected: `#19/#20` are JIRA-*present*
  (suppression) not the jiraNeeded flow; conflict PRs only derive `needsRebase` when
  actually diverged; dropped stale "current disposition" assertions; fleet stated as
  19 whitelisted / ~18 live (gaps `#14 #17`, `#26` closed).
- **haiku qualified** — applies to new sessions; resumed sessions keep their birth model.
- **Log greps** — added `PRC_LOG_LEVEL=debug` to the launch env so worker-tail debug
  lines show; greps narrowed to `[poll]`/`[dispatch]` (real logger tags).

## 1.0.0 — 2026-06-25

Initial skill. Battle-tests the running pr-controller against the **e2e sandbox
fleet** (`pr-controller#8–28`, ≈20 disposable `[e2e]` PRs on personal github.com),
widening `/run-pr-controller`'s 3-PR `dev` smoke to the full fleet and adding a
`@claude-debug` injection loop + a new-PR seeder.

Grounded in the live system before writing:

- Confirmed the `e2e` profile (`config.local.json` → `profiles.e2e`, whitelisting
  `#8–28`) scans cleanly read-only: `PRC_PROFILE=e2e node scripts/e2e-scan.mjs`
  enriched **18 live PRs** (`#26` closed), and every review thread derived
  `awaitingReviewer` because the operator authored the last comment — which is exactly
  why `@claude-debug` re-attribution (`scanner.mjs`/`rules.mjs` `applyDebugReviewer` →
  `DEBUG_REVIEWER`) is the driving mechanism.
- Mapped each fixture PR to its scenario from the live scan + branch names (failing-CI
  `#9–11`, feature threads `#12 #13 #15 #16 #18`, JIRA/compliance `#19 #20`, multi-thread
  `#22`, no-dispatch `#23`, clean-merge `#24`, conflict `#27 #28`).
- Verified the launch path: `smoke.sh` pins `PRC_PROFILE=dev`, so the skill launches
  `node server.mjs` directly with `PRC_PROFILE=e2e PRC_WORKER_MODEL=haiku` (config.mjs
  reads `PRC_WORKER_MODEL`; `worker.mjs` passes `--model haiku` — cheap stress test).
- Reused run-pr-controller's safety model verbatim: `config.onlyPRs` circuit-breaker +
  `scripts/worker-guard.mjs` mechanically blocking close/merge/delete/force-push.

Helpers:

- `inject-debug.sh <pr> "<feedback>" [root-id]` — replies to a PR's open review-thread
  root with `@claude-debug <feedback>` (review-thread comments only — top-level
  `gh pr comment` isn't re-attributed). Errors clearly on a thread-less PR.
- `whitelist-add.sh <repo#num>` — idempotently appends a new PR to
  `profiles.e2e.onlyPRs` (numerically sorted) and reminds to restart the daemon
  (config is read once at load).
