# TODO

_Done 2026-06-21 (verify green: 133 tests, react build, adherence lint; adversarially
reviewed; live-smoke-tested end-to-end against the dev sandbox incl. a real worker run):
worktree/session/worker-file cleanup on PR merge/close (+ safety guard verified live);
`recordDecision` mkdir-guard + `/decision` crash guard; worker-prompt polish (real worker
emitted a valid `fix` result); `reasonFull` render guard; observability augment. Also fixed
a pre-existing `ensureWorktree` bug surfaced by the smoke test: the fallback-clone path ran
`git clone` with cwd=`worktrees/` before that dir existed (`spawn git ENOENT`) — now mkdir'd._

## Ingestion hardening — smoke-tested 2026-06-21 (mostly cleared; 2 residuals)
The `scanner.mjs` rework was live-smoke-tested read-only against real github.com PRs
(no daemon / no worker dispatch / no mutations). Cleared the two cases the TODO called
out (cross-org set + closed/merged PR). Two residuals can't be force-induced safely here.

- [x] batched per-PR GraphQL fan-out (`buildBatchedQuery`/`enrichMany`): VERIFIED live —
      `scanAll` over 3 SAME-org sandbox PRs and over a 3-DIFFERENT-owner set
      (Slack-Reactor + hackreactor + this-Cunningham) each returned all PRs in ONE aliased
      query, 0 error-threads, no per-PR fallback. (`-f/-F` var passing accepted by `gh api
      graphql`.) Per-chunk fallback path is unit-tested but wasn't force-failed live.
- [x] `scanOnePr` cache-backed direct single-PR lookup: VERIFIED live — cache-hit returns
      the record without a `gh search` re-run; `scanOnePr(#6 MERGED) → null` and a premise
      check confirmed GitHub returns a non-null `state:"MERGED"` node (so cleanup fires now).
- [x] `updatedAt` change-filter + `PRC_REENRICH_FLOOR`: VERIFIED live — 4 back-to-back
      `scanAll()`s (floor=3) showed scan#1 cold-enrich (3/0, 1475ms), scan#2 reuse-from-cache
      (0/3, 762ms — the skip drops the batched fetch), scan#3 floor re-enrich (3/0), scan#4
      reuse (0/3). Added a per-scan log line (`scan #N: X enriched, Y reused …`) so the
      change-filter is observable in production.
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
- [x] **Observability** — augmented (done 2026-06-21, verify green + live-checked): added
      `log.mjs` leveled logger (`PRC_LOG_LEVEL`, optional `PRC_LOG_JSON`) and swapped the
      daemon `console.*` sites; persist the full worker transcript per run to
      `data/worker-<repo>-<num>.log` (was only `tail(-500)`); `poll()` no longer swallows —
      it records `lastPollError` into `state.json`, logs the stack, and the header shows a
      "⚠ scan failing" indicator; `scanOne` classifies failures (rateLimit/auth/forbidden/
      graphql) so the dashboard caption distinguishes a throttle. Cleanup-on-merge also
      reclaims the new `.log`. (Self-correction: tightened `isRateLimitError` so a bare 403
      permission error is no longer mis-retried as a throttle — only 429 / explicit text.)
  - [ ] _Remaining piece:_ per-PR `lastError` from the dispatcher's worker-run failure paths
        onto the card (a "worker crashed" badge). Deferred — it's the one part that adds a
        per-PR `state.json` field + a design-system card element; the worker-run failures are
        already logged + the full transcript persisted, so this is polish.

## Requires you (cross-repo — not mine to commit)
- [ ] `/pull-new-designs` skill edits (port the adherence-lint + DS-readme usage intent on a
      design-system import; warn against recreating the prototype's `controller` object and
      threading it as one prop through the tree) are written in
      `~/Documents/dev/claude-code-system/.claude/skills/pull-new-designs/` (SKILL.md v2→v3 +
      CHANGELOG) but LEFT UNCOMMITTED — review, commit/push there, then run `/sync-dot-claude`.
      The in-repo `pr-controller-react/src/design-system/README.md` (usage/intent distilled
      from the wabi-sabi readme) is committed here.
- [ ] (optional) The app's own `controller`-as-prop pattern (`controller.js`, threaded
      App→PRCard→ThreadRow) was NOT refactored — the skill fix only stops FUTURE imports from
      reproducing it. Refactoring the live app to idiomatic hooks/context is a separate,
      larger change if you want it.
