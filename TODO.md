# TODO

## Ingestion hardening — smoke-tested 2026-06-21 (mostly cleared; 2 residuals)
The `scanner.mjs` rework was live-smoke-tested read-only against real github.com PRs
(no daemon / no worker dispatch / no mutations). Cleared the two cases the TODO called
out (cross-org set + closed/merged PR). Two residuals can't be force-induced safely here.

- [ ] 403/429 + secondary-rate-limit backoff: classifier is unit-tested (incl. the fixed
      bare-403 false-positive) and backoff is bounded, but a REAL 429 / secondary limit
      can't be safely force-induced — it only bites at high volume (exactly the
      empty-`onlyPRs` / many-PRs case). Watch `[scanner] rate limited, backing off …s` the
      first time you widen scope; tune BATCH_SIZE / delays [1s,4s,10s] against what you see.

## Decided — follow-up implementation
- [ ] **Worker structured output** (was "should workers respond with structured output?")
      **Verified:** `claude` CLI v2.1.185 exposes `--json-schema <schema>` ("JSON Schema for
      structured output", works with `-p`/`--print`). It is NOT an Agent-SDK migration — just
      one more flag on the existing `spawn('claude', …)` in `worker.mjs`; the only real change
      is reading the validated object off the final `stream-json` result message instead of a
      file.
      **Recommendation — do it PARTIALLY, and only after the field vocabulary is settled
      (item 2 done):** adopt `--json-schema` with a LOOSE schema (require only `prKey`,
      `actions[].threadId`, `actions[].response ∈ fix|praise|surface`; everything else
      optional; NO `additionalProperties:false`), switch the worker from "write JSON to a
      path" to "emit the report as its final message", and KEEP `validateWorkerResult` as the
      daemon-side gate (belt + suspenders; the flag's stability isn't guaranteed across CLI
      versions). Do NOT go strict — a tight/required-heavy schema turns today's graceful "drop
      the bad action + log drift" into hard worker FAILURES on an unattended daemon, and a
      schema only guarantees SHAPE: it cannot catch the real hazard (a `fixed` reply without a
      push). Net: low marginal value over the already-hardened `validateWorkerResult`; worth
      doing for belt-and-suspenders, not urgent. Touches `worker.mjs` (spawn flag + read the
      result off stream-json, not the file) and `worker-prompt.md` (§Output: "this is your
      final message", not "write to a path"); add a `rules.test.mjs` case asserting a
      schema-shaped result still passes `validateWorkerResult`.
- [ ] **Observability — remaining piece:** per-PR `lastError` from the dispatcher's worker-run
      failure paths onto the card (a "worker crashed" badge). The worker-run failures are
      already logged + the full transcript persisted, so this is polish. (Note: PR #30 added a
      `workerError`/`workerFailed` Needs-you surface for failed runs — re-check whether this is
      now substantially covered before building more.)

## New
- [ ] Daemon could use a scoped `--allowedTools` list (Write, Edit, Bash(git:*), Bash(gh:*)) instead
      of blanket `--permission-mode bypassPermissions` for workers — least-privilege, and it sidesteps
      the claude root-guard on any host without IS_SANDBOX (proven viable: a scoped
      `--allowedTools 'Bash(gh:*)'` worker ran with permission_denials:[] and no
      --dangerously-skip-permissions). Worth considering for worker.mjs runWorker.
- [ ] Explore/design a first-run + settings **config UI panel** ("setup mode"). Feasibility
      confirmed: serve the React UI while the poll/dispatch loop is GATED on a valid config —
      the HTTP server and poll loop are already decoupled (poll() only starts in the
      `server.listen` callback, server.mjs:359-364). Scope to explore:
      - `validateConfig()` (config.mjs/rules.mjs) + gate the poll() kickoff (server.mjs:362);
        render a `SetupPanel` vs the lanes (App.jsx:87), reusing the existing `lastPollError`/
        "⚠ scan failing" plumbing (Header.jsx:23) + EmptyState/Callout/Button DS components
        (no form components exist in the design system yet).
      - SAME panel does first-run AND ongoing edits (first-run is just the empty state).
      - Persist edits via a daemon-owned, gitignored `data/config.local.json` that config.mjs
        merges UNDER env (env > file > profile) — NOT by rewriting config.mjs in place; maybe an
        "export to .env/committed" action for durability on ephemeral hosts. New `/config` +
        per-check preflight endpoints (server-authoritative; React just renders/POSTs).
      - Live red/green preflight steps for the real first-run blockers: gh auth/host/login,
        scope (onlyPRs = circuit-breaker; force an explicit choice — empty = ALL prod PRs),
        clone discovery + ssh/https (cloneRoot/gitProtocol), git identity + push, claude worker
        readiness incl. root/IS_SANDBOX detection, workerModel, and a "run one test worker"
        GO/NO-GO gate.
      - Note hot-swappable fields (onlyPRs, checks, tokens, workerModel-for-new-sessions) vs
        restart-required (host→ghEnv, port, the pollMinutes interval, cloneRoot→repo-map).
- [ ] add evals for the claude pr workers
- [ ] figure out cloud-env startup script changes to accommodate our new config.local.json setup so we can run this in cloud sessions
- [ ] ability to restart the daemon via the ui?
      The daemon serves its own UI, so it can't restart itself unsupervised — it needs a supervisor
      that relaunches on exit (launchd on macOS, or pm2), a `POST /restart` endpoint (write
      config.local.json → `process.exit(0)`), and a reconnect-after-restart UX (the React app
      already has SSE auto-reconnect + /state.json polling). This is the blocker for the
      restart-required settings-panel fields (host, port, clone folder, ssh/https) — see TODO_UX.md.
- [ ] Orphaned `claude` worker processes on daemon process-termination. The graceful winding-down drain is wired ONLY to the disarm toggle (stopPolling); a process kill (pkill to redeploy, Ctrl-C, crash, reboot) bypasses it and orphans in-flight workers (reparented to launchd). worker.mjs spawns `claude` as a plain child (no detached, handle not tracked) and there is NO SIGTERM/SIGINT handler in server.mjs. Effects while orphaned: keeps acting on the PR unsupervised (push/comment/rebase under bypassPermissions; worker-guard still blocks close/merge/delete/force-push), burns API $, may die mid-action on a broken stdout pipe (EPIPE) leaving partial state, writes a result JSON that races the next daemon, and — worst — can collide with a new same-PR worker on the same session UUID + worktree because the in-memory dispatcher `running` lock doesn't survive a restart → session/worktree corruption. Fix: track worker child handles (worker/dispatcher layer) and add a SIGTERM/SIGINT handler that runs the same drain as disarm — wait up to a bounded timeout for in-flight workers, then kill stragglers — so a restart behaves like the toggle. Also consider logging dispatch on SPAWN (not just on completion) so current-vs-orphan workers are distinguishable in observability (this ambiguity made the e2e cap test take ages to debug).
- [ ] ability to customize worker sensitivity prompts and "restore to default" if needed
- [ ] put the worker sensitivity panel under a separate tab within the settings panel
