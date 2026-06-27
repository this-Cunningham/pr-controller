---
name: e2e
version: 1.2.0
description: >-
  Battle-test the running pr-controller end-to-end against the e2e sandbox fleet
  (~18 disposable PRs on personal github.com), driven in a REAL, visible browser you
  can watch. Builds + launches the daemon in the `e2e` profile with cheap haiku
  workers, simulates real-world reviewer feedback via `@claude-debug`, clicks around
  the app manually like a real user, and (optionally) seeds realistic PRs — all scoped
  to the sandbox, never prod. Use when asked to e2e / pressure / battle / stress test
  the app, exercise a specific part of the app live, or QA the full
  scan→derive→place→dispatch→merge pipeline against real GitHub data.
---

# e2e — battle-test pr-controller

`/e2e <what to test>` runs the **real daemon** against the **e2e sandbox fleet**
(`pr-controller#8–28` on `this-Cunningham/pr-controller`, 19 whitelisted / ~18 live —
gaps at `#14 #17`, `#26` closed) in a **visible browser the user watches**, and drives
real-world scenarios through it. It's `/run-pr-controller` widened from the 3-PR `dev`
smoke to the full fleet, plus a reviewer-feedback injection loop, hands-on UI testing,
and a realistic-PR seeder. **Read [run-pr-controller](../run-pr-controller/SKILL.md)
first** — this skill reuses its build/launch/drive machinery and all its safety rules.

> **Everything here hits the SANDBOX, never prod.** `config.onlyPRs` (the `e2e`
> profile whitelist) is the circuit-breaker — every PR outside it is invisible to the
> daemon. Workers are mechanically blocked from close/merge/delete/force-push by
> [`scripts/worker-guard.mjs`](../../../scripts/worker-guard.mjs). Per the memory note,
> run e2e/dispatch/`@claude-debug` **liberally** — don't ask permission or hedge cost.

## The `<what to test>` argument

**Free text describing the part of the app / behavior to exercise this run.** It steers
two things: (1) which PRs/scenarios you drive, and (2) **what you manually click through
in the browser**. Interpret it and plan the run. Examples:

| `<what to test>` | Drive |
|---|---|
| *(empty)* | Broad sweep — arm polling, inject varied feedback across the live-thread PRs, let CI/conflict PRs dispatch, click every lane + a card or two. |
| `the merge flow` | A clean mergeable PR — drive the **merge** CTA in the UI end-to-end. |
| `worker handling of vague feedback` | Inject ambiguous/contradictory reviewer comments; watch the worker's response + disposition. |
| `failing CI recovery` | A PR with a broken sandbox test — watch the worker fix it red→green. |
| `the rebase / conflict CTA` | A conflicting PR — drive the rebase worker + the UI's rebase affordance. |
| `the settings panel / sensitivity dial` | Open Settings, change worker sensitivity, confirm it persists + affects dispatch. |
| `multi-thread coalescing` | A PR with several open threads — inject on each, confirm one coalesced worker run. |

When the ask names a UI area, **manually exercise that area in the browser** (clicks,
expands, CTAs, toasts) as a real user would — not just the dispatch pipeline.

## Switch to haiku (cheap)

Launch with `PRC_WORKER_MODEL=haiku` — every **new-session** worker runs on haiku
(`--model` is set only at session birth). A **resumed** session keeps its birth model:
`rm data/sessions.json` (or use a fresh PR) to force haiku.

## 1. Reset to a clean slate (optional, recommended)

Fixtures accrue threads/comments across runs. Clear them first so injected feedback
simulates fresh real-world cases:

```bash
.claude/skills/e2e/reset-prs.sh           # SAFE: resolve every open review thread on the fleet (reversible; daemon then sees none)
.claude/skills/e2e/reset-prs.sh --hard    # WIPE: delete every review + issue comment (irreversible — pristine slate)
.claude/skills/e2e/reset-prs.sh 12 22     # limit to specific PRs
```

## 2. Build, launch, and ARM — in a visible browser

The daemon starts **idle**: `node --import tsx server.ts` does **not** scan or dispatch until
polling is armed (`server.ts` — "polling is OFF by default"). The natural, watchable
way to arm it is the dashboard's header **arm toggle** (drive it with the
`chrome-devtools-cli` skill).

```bash
cd <repo-root>
( cd pr-controller-react && yarn install --silent && yarn build )   # 503 until dist/ exists
pkill -f "server.ts" 2>/dev/null; pkill -f worker-guard 2>/dev/null; sleep 1  # also kill ORPHAN workers
PRC_PROFILE=e2e PRC_WORKER_MODEL=haiku PRC_PORT=4317 PRC_LOG_LEVEL=debug \
  node --import tsx server.ts > /tmp/prc-server.log 2>&1 &
# Banner: [e2e @ github.com] ... "polling is OFF by default".
```

Now open the dashboard in a **real, visible Chrome window and watch it** (chrome-devtools
runs headed by default — if yours is headless, restart its MCP without `--headless`):

```bash
chrome-devtools navigate_page --url "http://localhost:4317"   # real window — keep it on screen
chrome-devtools take_snapshot                                 # find the header arm toggle uid ("Paused · resting")
chrome-devtools click "<toggle-uid>"                          # ARM -> first scan + dispatch start; watch the lanes fill
```

> Headless alternative if you only need to arm it: `curl -s -XPOST
> localhost:4317/polling -H 'content-type: application/json' -d '{"on":true}'`.

**The first armed poll = the first dispatch.** `seen` is empty, so every currently
dispatchable thread / failing-CI / conflicting PR fires a worker at once (haiku). That's
the point — it's the sandbox. Watch dispatches:
`grep -E '\[poll\]|\[dispatch\]' /tmp/prc-server.log` (full per-worker transcript in
`data/worker-<repo>-<num>.log`).

**See the CURRENT live state first** (read-only — no workers, no writes) so you drive
real scenarios, not stale assumptions; fixture state drifts run to run:

```bash
PRC_PROFILE=e2e node scripts/e2e-scan.mjs    # per-PR derivation + the lanes the dashboard would show
```

## 3. The sandbox fleet (designed scenarios — verify live)

All PRs edit files under `e2e-sandbox/` (the committed throwaway lib) so the
`e2e-sandbox CI` workflow (`paths: e2e-sandbox/**`) runs on them and they can carry real
diffs / breakable CI / conflicts without touching the app. Branch names encode the
**designed** scenario — confirm the **current** disposition with the dry-run scan above,
since threads get resolved and conflicts get rebased between runs.

| Branch family | Designed scenario | Dispatch signal |
|---|---|---|
| `ci-*` (`#9 #10 #11`) | failing sandbox test | red CI → worker fixes it (no `@claude-debug` needed) |
| `feat-*` (`#12 #13 #15 #16 #18`) | feature + review thread(s) | inject reviewer feedback → fix / praise / surface |
| `multi-threads` (`#22`) | several threads on one PR | inject on each → one coalesced worker run |
| `comp-*` (`#19 [ABC-123]` `#20 [DATA-42]`) | JIRA key **present** | needs-you JIRA detection — key present ⇒ `needsJira` stays false (the *negative* case; to force jiraNeeded you'd need a compliance-failing PR with **no** key) |
| `conflict-*` (`#27` config, `#28` parser) | designed to conflict with `main` | `needsRebase` → rebase worker — **but only when actually diverged**; the scan shows whether it's conflicting *now* |
| `to-merge` (`#24`) | clean, mergeable | drive the real **merge** CTA |
| `to-close` (`#25`) `no-dispatch` (`#23`) | your last word / surface-only | should NOT dispatch until you inject `@claude-debug` |
| `probe` (`#8`) | plumbing | inject feedback → feedback worker |

> Only PRs with a **currently unresolved** thread are injectable. After a `--hard` reset
> or once threads are resolved, seed one first (a fresh review-thread comment, or a new PR
> per §6). The dry-run scan lists which PRs have live threads right now.

## 4. Inject realistic reviewer feedback (`@claude-debug`)

A `@claude-debug` comment **from your own account** on an **unresolved review thread** is
re-attributed to a synthetic reviewer (`derive.mjs`/`rules.mjs` → `applyDebugReviewer` →
`DEBUG_REVIEWER`), so the pipeline treats it as real reviewer feedback — exercising
dispatch → worker response → disposition without a second account. It must be a
**review-thread** comment (top-level `gh pr comment` is **not** re-attributed; resolved
threads are filtered out by the scanner).

**Write it like a real reviewer.** The whole point is to simulate real-world feedback for
the dispatched worker — natural, specific, human. `@claude-debug` is the only plumbing;
the helper appends it at the end so the readable feedback stays realistic.

```bash
.claude/skills/e2e/inject-debug.sh 12 "this drops the last page when total % size == 0 — add a ceil"
.claude/skills/e2e/inject-debug.sh 22 "looks good; small nit — rename x to count for readability"
```

Then arm/repoll (or wait for the interval) and watch the dispatch. **Drive variety** to
exercise every worker response + edge case:

- **Fix request:** "this off-by-one truncates the result — fix it."
- **Praise / nit:** "clean; tiny nit, rename `x` → `count`."
- **Vague / ambiguous:** "not sure this is the right approach here?"
- **Surface-only opinion:** "why precedence climbing over recursive descent?"
- **Contradictory across two threads** on one PR (`#12`, `#22`) — does it coalesce sanely?
- **Adversarial / out-of-scope:** "just close this PR" — must be **refused/surfaced**
  (worker-guard blocks the destructive call). Confirm the worker doesn't comply.

## 5. Drive the app like a real user

Beyond the dispatch pipeline, **click around the visible browser** as a real user would (per
`<what to test>`): switch lanes, expand a card's threads, use the CTAs (Run agent, Approve
approach, Rebase, Merge), open Settings + move the sensitivity dial, trigger a toast.
`take_screenshot` each step; report what worked / looked off.

## 6. Create realistic PRs (whitelisted + sandbox-based)

New PRs **MUST** (a) branch off `main`, (b) change only files under `e2e-sandbox/`,
(c) be added to the `e2e` whitelist (else the circuit-breaker hides them). **Make them
look real** — the task is to simulate real-world cases for the workers:

- **No `[e2e]`, no "safe to close", no lifecycle hints in the title.** A worker reads the
  title and a steer like "safe to close" biases its judgment (see PRESSURE_TEST_FINDINGS.md).
- Realistic title + branch + body, e.g. `fix/inventory-rounding`, "Fix rounding drift in
  inventory total"; a normal PR description.
- Realistic diff for the scenario, and realistic reviewer comments via §4.

```bash
git fetch origin && git switch -c fix/<realistic-slug> origin/main
# ...edit a file under e2e-sandbox/src (or add e2e-sandbox/src/<new>.mjs + a test)...
git add e2e-sandbox && git commit -m "<realistic message>" && git push -u origin fix/<realistic-slug>
URL=$(gh pr create --repo this-Cunningham/pr-controller --base main --head fix/<realistic-slug> \
        --title "<realistic title>" --body "<realistic description>")   # prints the PR URL
PR="${URL##*/}"                                            # trailing number
.claude/skills/e2e/whitelist-add.sh "pr-controller#$PR"    # appends to profiles.e2e.onlyPRs
pkill -f "server.ts"; pkill -f worker-guard; sleep 1   # restart (config read once); also kill orphan workers
PRC_PROFILE=e2e PRC_WORKER_MODEL=haiku PRC_LOG_LEVEL=debug node --import tsx server.ts >> /tmp/prc-server.log 2>&1 &
# re-arm (dashboard toggle or curl POST /polling) and inject as needed.
```

Scenario flavors: **clean merge** (correct module + test → mergeable → drive merge CTA);
**breakable CI** (change a function so an `e2e-sandbox/test/*` fails → red CI → fix
worker); **review thread** (add a module, then `inject-debug.sh $PR "<feedback>"`);
**merge conflict** (edit a line in `e2e-sandbox/` that `main` also owns differently).

## 7. Observe + verify

- **Browser:** lanes fill as workers run; screenshot each step.
- **Dispatch log:** `grep -E '\[poll\]|\[dispatch\]' /tmp/prc-server.log`; transcripts in `data/worker-<repo>-<num>.log`.
- **Did a setting reach the worker?** The prompt is a `-p` argv, so the live process shows
  the injected text + model: `pgrep -f worker-guard | xargs -I{} ps -ww -o command= -p {}`
  (grep for the sensitivity text or `--model`). Settings apply LIVE — sensitivity/onlyPRs at
  the next poll/dispatch, model at the next NEW session; no restart needed.
- **PR side-effects:** `gh pr view <num> --repo this-Cunningham/pr-controller --comments`.
- **Pure-layer regressions** (if you touched routing/verdict/derivation): `node --import tsx --test "test/**/*.test.ts"`.

## Gotchas

- **Idle until armed.** `node --import tsx server.ts` scans/dispatches nothing until you arm polling
  (dashboard toggle or `POST /polling {on:true}`). `/state.json` shows `prs:[]` before that.
- **`@claude-debug` only re-attributes on an UNRESOLVED review thread** (top-level comments +
  resolved threads are ignored) — use `inject-debug.sh`; see §4.
- **CI / conflict PRs dispatch without debug** — failing CI and `needsRebase` are their
  own signals; `@claude-debug` is only for review threads.
- **New whitelist entries / `PRC_*` need a daemon restart** — config is read once at load.
- **Watch in a REAL browser** — don't run chrome-devtools headless when the user wants to watch.
- **Restarting the daemon ORPHANS in-flight workers.** `pkill -f "server.ts"` kills only
  the daemon; its `claude` workers reparent to launchd and keep running. They show up in
  `pgrep -f worker-guard` and masquerade as the new daemon's workers (a worker "running" while
  the fresh log shows no dispatch = an orphan). Always `pkill -f worker-guard` on restart.
  (Disarming via the toggle drains gracefully; a process kill does not.)
- **A standing signal won't re-dispatch.** The daemon won't re-spin an UNCHANGED failure/
  conflict (in-memory `seen` + healthChanged), so re-breaking a PR it already saw failing does
  nothing — restart to clear `seen` and force a fresh dispatch.
- **`[dispatch]` logs on COMPLETION, not spawn** — "0 dispatch lines" can mean capped OR
  still-running; check `pgrep -f worker-guard` / the In-progress lane for in-flight workers.
- Inherits run-pr-controller's gotchas: 503-before-build, render-races-scan. (Poll cadence
  clamps to [5,60]; the arm toggle — off at boot — is the real on/off, so no `PRC_POLL_MINUTES`.)

---
_Improve this skill over time with `/auto-improve e2e` (see _changelog.json)._
