# TODO

## Ingestion hardening — smoke-tested 2026-06-21 (mostly cleared; 2 residuals)
The `scanner.ts` rework was live-smoke-tested read-only against real github.com PRs
(no daemon / no worker dispatch / no mutations). Cleared the two cases the TODO called
out (cross-org set + closed/merged PR). Two residuals can't be force-induced safely here.

- [ ] 403/429 + secondary-rate-limit backoff: classifier is unit-tested (incl. the fixed
      bare-403 false-positive) and backoff is bounded, but a REAL 429 / secondary limit
      can't be safely force-induced — it only bites at high volume (exactly the
      empty-`onlyPRs` / many-PRs case). Watch `[scanner] rate limited, backing off …s` the
      first time you widen scope; tune BATCH_SIZE / delays [1s,4s,10s] against what you see.

## New
- [ ] Daemon could use a scoped `--allowedTools` list (Write, Edit, Bash(git:*), Bash(gh:*)) instead
      of blanket `--permission-mode bypassPermissions` for workers — least-privilege, and it sidesteps
      the claude root-guard on any host without IS_SANDBOX (proven viable: a scoped
      `--allowedTools 'Bash(gh:*)'` worker ran with permission_denials:[] and no
      --dangerously-skip-permissions). Worth considering for worker.ts runWorker.
- [ ] Explore/design a first-run + settings **config UI panel** ("setup mode"). Feasibility
      confirmed: serve the React UI while the poll/dispatch loop is GATED on a valid config —
      the HTTP server and poll loop are already decoupled (poll() only starts in the
      `server.listen` callback, server.ts:359-364). Scope to explore:
      - `validateConfig()` (config.ts/rules.ts) + gate the poll() kickoff (server.ts:362);
        render a `SetupPanel` vs the lanes (App.jsx:87), reusing the existing `lastPollError`/
        "⚠ scan failing" plumbing (Header.jsx:23) + EmptyState/Callout/Button DS components
        (no form components exist in the design system yet).
      - SAME panel does first-run AND ongoing edits (first-run is just the empty state).
      - Persist edits via a daemon-owned, gitignored `data/config.local.json` that config.ts
        merges UNDER env (env > file > profile) — NOT by rewriting config.ts in place; maybe an
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
- [x] Orphaned `claude` worker processes on daemon process-termination. **DONE:** worker.ts
      now tracks every spawned child in a `liveWorkers` set (`liveWorkerCount`/`killAllWorkers`)
      and exposes a bounded `drainWorkers()` policy (wait ≤`config.shutdownGraceMs` for in-flight
      workers to finish, then SIGTERM, then SIGKILL stragglers). server.ts wires SIGTERM/SIGINT
      to a `shutdown()` that stops polling, closes the HTTP server, and drains — so a kill behaves
      like the disarm toggle instead of orphaning workers (a second signal forces immediate exit).
      Dispatch is now logged on SPAWN (pid + session) so a current worker is distinguishable from
      an orphan. Grace is `PRC_SHUTDOWN_GRACE_MS`-overridable (default 15s). Tested:
      `test/worker.test.ts` locks the drain/escalation policy.
      Original report: the graceful winding-down drain was wired ONLY to the disarm toggle
      (stopPolling); a process kill (pkill to redeploy, Ctrl-C, crash, reboot) bypassed it and
      orphaned in-flight workers (reparented to launchd). Effects while orphaned: kept acting on the
      PR unsupervised (push/comment/rebase under bypassPermissions; worker-guard still blocks
      close/merge/delete/force-push), burned API $, could die mid-action on a broken stdout pipe
      (EPIPE) leaving partial state, wrote a result JSON that raced the next daemon, and — worst —
      could collide with a new same-PR worker on the same session UUID + worktree because the
      in-memory dispatcher `running` lock doesn't survive a restart → session/worktree corruption.
- [ ] ability to customize worker sensitivity prompts and "restore to default" if needed
- [ ] put the worker sensitivity panel under a separate tab within the settings panel
- [ ] a way to edit all agent prompts in the system from the UI and save them.
- [ ] **Harden the worker result seam.** A worker run can fail to hand back a clean, usable
      result — malformed output, none at all, cut short (output-token limit, refusal, error), or
      dead mid-run. Today any of these can leave a PR silently stuck instead of clearly flagged. A
      run should never leave a PR in a wrong or ambiguous state: its result is always usable, or its
      failure is clearly surfaced.
- [ ] suggested approach could potentially be an array the agent can surface 1-3 approaches and we
      can select the best one in the "needs you" cards
- [ ] setup tools for agent workers, can they use jira cli to pull in ticket context while investigating pr
- [ ] Convert the app to TypeScript — bugs are slipping through that static analysis would catch
      (e.g. the `readWorkerResult() !== null` always-true bug this session, where the return-shape
      contract drifted from object to nullable without a compile error). TS would catch contract
      drift across the module seams (sessions/paths/derive boundaries, worker-result shape,
      dispatcher opts).
