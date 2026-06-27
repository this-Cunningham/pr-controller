# pr-controller — behavior specification

The authoritative statement of what this system should do. Deterministic rules
marked **[tested]** are locked by `test/rules.test.ts`; judgment rules marked
**[prompt]** live in `worker-prompt.md` and are enforced by the worker model. For HOW
the system is built — the data flow and the server-authoritative placement model — see
[ARCHITECTURE.md](ARCHITECTURE.md).

## Purpose
Watch all of the user's open PRs across the enterprise and, per PR, dispatch a
headless Claude worker to address reviewer feedback, fix CI, and rebase — while
surfacing anything needing the user's judgment to a localhost dashboard. The user
should rarely babysit PRs; they intervene only on threads the agent surfaces for
their judgment (disagreements, scope/product calls, or anything it can't safely
decide) and decisions.

## Architecture
- One persistent Node daemon (`server.ts`) on the user's awake laptop. It dies on
  sleep/reboot by design — this is a drive-it-during-work tool, not a service.
- Every 15 min it polls (pure Node + `gh`, no Claude), diffs against last poll, and
  dispatches a worker only for PRs that changed.
- Workers are headless `claude -p`, one durable session per PR (resumed across
  rounds), running in a per-PR git worktree.
- A dashboard (http://localhost:4317) renders the daemon's flat `placements` list into
  three lanes — Needs you / In progress / Waiting on reviewer; PRs float to the top by
  their `sortRank`. The daemon owns routing (see ARCHITECTURE.md); the frontend renders it.

## Discovery
- Open PRs come from `gh search prs --author @me --state open` against `config.host`.
- Discovered PRs are filtered to the **scope allowlist** `config.onlyPRs`
  (`inScope` [tested]) BEFORE any threads are fetched — out-of-scope PRs are
  invisible to the daemon (not scanned, not rendered, never worked). Empty/null
  `onlyPRs` = all PRs.
- Per PR, GraphQL fetches unresolved review threads, `mergeable`/`mergeStateStatus`,
  and the CI check rollup.

## Dispatch — when a worker runs
A worker is dispatched for a PR when, since the last poll, EITHER:
- a review thread is new/changed AND is **dispatchable**, OR
- branch health changed AND there is health work (a real merge conflict, or
  failing code CI).

**Dispatchable thread [tested]** (`dispatchable`): a thread dispatches unless the
user's own comment is the latest one — they're annotating or waiting on the
reviewer. Exception: the user's comment containing `config.triggerToken`
(`@claude-plz-fix`) opts that single thread back in.
- Reviewer had the last word → dispatch (incl. reviewer replying on the user's own thread).
- User's plain annotation / reply → no dispatch.
- User's comment with the token → dispatch (next poll, never instant).
- After the bot replies (as the user) → no re-dispatch.
- **TEMP (debug):** `config.debugToken` (`@claude-debug`) opts a thread in the same
  way `triggerToken` does — present so the owner can seed dispatchable threads from
  their own account on the sandbox PR. Remove once real reviewer threads exist.

Re-dispatch is prevented by the last-author rule, NOT by resolving threads — so a
server restart (which clears the in-memory seen-map) will not re-process handled
threads.

Dispatch is **out-of-band**: `poll()` does not await the worker. It scans,
derives every PR's fields from the *existing* worker result, writes `state.json`,
and hands changed PRs to the dispatcher (below), which runs workers serially per PR
and refreshes each PR when its worker exits.

## Worker context model
- **First run** (new session): full `worker-prompt.md` rules + the PR diff, to build
  durable understanding. Receives all currently-open dispatchable threads.
- **Resume** (later polls): a short delta preamble + only the NEW threads. Relies on
  session memory for prior context; re-grounds volatile state via `git pull
  --ff-only` and `git diff <lastSeenSha>..HEAD`.
- **Apply-approved resume** (`opts.applyApproved`): same re-ground, but the preamble
  says the user approved an approach the worker proposed on the listed threads — carry
  it out as a fix, don't triage it as new feedback (§Apply-approved).
- Rules/diff are sent ONCE at session birth, never re-injected. Editing
  `worker-prompt.md` only affects new sessions; existing sessions must be
  invalidated (delete their `sessions.json` entry) to pick up changes.

## Response taxonomy [prompt]
For each unresolved reviewer-authored thread, exactly one:
- **fix** (includes minor nits — nits are actionable): make the change, reply
  `fixed` (lowercase, exact), and leave the thread OPEN. Only after the fix is
  pushed. The worker does NOT resolve a fixed thread: `fixed` is the internal
  done-marker, and the reviewer's resolve is the real "done" + their merge gate. An
  unresolved-`fixed` thread is an honest signal ("agent addressed it; reviewer
  hasn't confirmed") and is what keeps the thread visible in the Waiting on reviewer
  lane (disposition `agentAutoFixed`) instead of vanishing from the scan.
- **praise** (positive, nothing to change): add a 🎉 `hooray` reaction, no text,
  then resolve (praise still resolves — there's nothing for the reviewer to confirm).
- **surface** (needs the user's judgment — a disagreement, a scope/product call, a
  risk the agent won't take on its own, or something it can't confidently decide):
  do nothing to the thread
  — no reply, no reaction, no resolve. Record why, with code citations. May ALSO
  carry, to speed the user up:
  - `suggestedReply` — a code-cited draft reply to the reviewer (the user edits/sends
    it via the existing rebuttal box; the worker never posts it). Rendered pre-filled.
  - `suggestedApproach` — a proposed fix + why the worker wants sign-off. The user can
    **approve** it (staged, not auto-run); see §Apply-approved.

Rules: never post curt text like "ack"/"ok"/"thanks" (react instead); never reply
`fixed` without an actual pushed fix; resolve a praised thread but leave a fixed
thread OPEN for the reviewer to confirm; never resolve a surfaced thread.

**Accepted tradeoff:** an unresolved `fixed` thread may block merge on repos that
require conversation resolution. That's fine — the reviewer resolves it to merge
(the resolve they'd do anyway), and the open thread is an honest "awaiting
confirmation" signal.

## Apply-approved (staged Apply) [prompt]
A surfaced thread carrying `suggestedApproach` can be **approved** by the user. The
dashboard STAGES approvals per PR (a local "cart") — approving does NOT dispatch.
A per-PR "Run agent (N)" control fires ONE **resumed** worker with all staged threads
in a single batch. The worker's resume preamble switches to the **apply-approved**
variant: it's told the user approved the approach it proposed on those threads, and to
carry it out as a normal `fix` (commit/push/reply `fixed`/resolve) rather than triage
fresh feedback. Re-grounding (`git pull --ff-only` + `git diff <since>..HEAD`) still
runs; if the branch can't fast-forward, the dispatcher surfaces `outOfSync` instead of
launching. Non-worker actions (rebuttal `note`, `set-jira`) stay immediate and
un-bundled — they have no session/worktree and cannot collide.

## Judgment — lean toward fixing [prompt]
Default to agree-and-fix, grounded in the PR diff + current code. Surface only with
a concrete, code-cited reason: it would introduce a bug/regression/security hole,
contradicts a deliberate design choice visible in the code, is genuinely larger
than this PR's scope, or the correct change can't be determined. A reviewer phrasing
something as a question is not by itself a reason to surface.

## CI & rebase [prompt + tested]
- **Code CI** failures caused by this PR's changes → fix and push. Unrelated/flaky
  or test failures not attributable to the change → surface. Never edit a test to
  make it pass.
- **Compliance checks** (`config.complianceChecks`, e.g. `compliance/sox`) →
  categorized separately [tested]. When failing AND the PR title lacks a JIRA key
  (`config.jiraPattern`) → `needsJira` [tested], surfaced with a dashboard input box
  that prepends `[TICKET]` to the title.
- **Ignored checks** (`config.ignoreChecks`, e.g. license/CLA/DCO) → dropped.
- **Rebase on merge conflict** (`needsRebase` = `mergeable CONFLICTING` or
  `mergeState DIRTY` [tested]) — NOT gated on approval. ANY merge conflict
  auto-dispatches a rebase. Two paths:
  - **Folded into a worker run.** When the worker is already dispatched for feedback
    or CI, and the branch also has a conflict, the run also rebases (`rebaseOnConflict`
    → `opts.rebase`): the branch is changing anyway, so it dismisses no extra reviews.
  - **Idle conflict → auto-rebase.** When a conflict exists with *nothing else to do*,
    the daemon AUTO-enqueues a rebase-only run (`dispatcher.enqueueRebase`, gated on
    `healthChanged` so it doesn't re-spin every poll): a conflicted PR can't merge
    anyway, so freshness wins over approval-preservation. **Conscious
    tradeoff:** auto-rebasing an already-approved idle PR force-pushes and dismisses
    its approval. Clean rebase → push `--force-with-lease`; non-trivial conflicts →
    surface, never guess. Once the agent surfaces a conflict as too risky, the daemon
    stops auto-retrying it (it stays in Needs you for the user) until the conflict clears
    — a later health change (even an unrelated CI flip) must not re-spin a rebase that
    would just bail again. [tested: `dispatchDecision` with `rebaseSurfaced`]
  - The informational "behind base" pill (`isBehindBase`: branch BEHIND or
    CONFLICTING/DIRTY) is NOT approval-gated — it's a fact about the branch
    regardless of review state. Rebasing is driven by the conflict, not approval.

## Worktrees & git safety
- Reuse the user's existing local clones, discovered under `config.cloneRoot` by git
  remote (not directory name) [tested: `repoSlug`], recursively to depth 2.
  Duplicate slugs prefer the shallowest (standalone) clone over nested workspace
  copies. Clone into `worktrees/<repo>.git` only if not found locally.
- One worktree per PR, off the existing clone, kept until merge.
- Decision tree: existing managed worktree → resume + `pull --ff-only` (surface if it
  can't fast-forward). Branch checked out clean elsewhere → reuse it. Branch checked
  out DIRTY elsewhere → `--detach` worktree at the branch tip, push `HEAD:<branch>`;
  never stash. Not checked out → fresh worktree on the branch.

## Live status & concurrency
- **Per-PR serialization (the dispatcher).** All worker dispatch goes through
  `dispatcher.ts`, which keeps one in-flight worker per PR. Work arriving while a PR
  is busy — new poll-found dispatchable threads OR user-approved approaches — lands in
  that PR's **pending set** and **auto-fires** when the lock frees, draining everything
  pending into a single batched run (one re-ground + push, never a double-dispatch).
  This is the coalescing point: poll-found threads and user approvals unify under
  "whatever is pending when the lock releases runs next." A run that re-surfaces a
  thread does not re-stage it (only genuinely new threads/approvals enter pending), so
  the drain loop can't spin. `ensureWorktree`+`runWorker` are serialized as a unit, so
  two triggers can't race on the same worktree.
- **The module-level `polling` boolean** still guards whole *scans* (one at a time); it
  is orthogonal to the per-PR worker lock.
- **SSE live status (`GET /events`).** A worker launching/exiting pushes the in-flight
  `prKey` set (`worker-started`/`worker-finished`) so the dashboard shows "agent
  working…" instantly, not on the 60s client poll. A per-PR refresh pushes
  `state-updated`, nudging the client to re-fetch `state.json` (the durable snapshot).
  The 60s poll remains as a fallback. State is in-memory only — the daemon dies on
  sleep by design, so nothing is persisted.

## Permissions
- Workers run headless with `--permission-mode bypassPermissions` (full autonomy,
  isolated to the subprocess; the user's interactive sessions are untouched).
- `auto` is NOT usable for workers: headless, it silently denies tools not on the
  allowlist (e.g. `Write`), so workers would stall.
- `plan` mode is enforced read-only — used only for observe/classify trials.

## Scope (`onlyPRs`)
`config.onlyPRs` is the scope primitive and prod circuit-breaker — there is no
dry-run/SAFE_MODE mode; the worker always executes the real path (push / comment /
resolve / rebase) on the PRs it can see.
- **Empty/null** → all of your open PRs (full production).
- **A list of `repo#number` keys** → ONLY those PRs are scanned, rendered, and
  worked; everything else is invisible. This is both the hardening sandbox (scope to
  one throwaway PR, e.g. `site-vdp-remix#835`) and a permanent way to scope or stop
  the daemon. The filter is `inScope` [tested], applied at discovery.

## Sessions
- One UUID per PR (`sessions.json`), persisted ONLY when a worker actually spawns,
  so a session that never launched can't leave a phantom entry that `--resume`
  can't find.
- `lastSeenSha` records the worktree HEAD after each run for the resume delta diff.

## Dashboard dispositions — derived from the worker's verdict [tested: `deriveDisposition` in test/rules.test.ts]
Each thread's **disposition** (the per-item verdict) comes from the worker's
code-grounded `response` (read from `data/worker-<repo>-<num>.json` and merged by
`threadId` in `derive.ts`/`deriveRecord`), NOT a keyword heuristic. The frontend
(`adapt.ts` `DISPOSITION_TO_TAG`) maps each disposition to the design system's short
tag vocabulary (`input | fixed | waiting | pending | praise | error`) for styling only:
- **surface** → `needsYourApproval` (carries the worker's code-cited reason).
- **fix** (incl. apply-approved) → `agentAutoFixed` — the worker changed code and
  replied `fixed` but does NOT resolve (§taxonomy), so the thread stays OPEN and is
  scanned naturally; this is the stable, visible "addressed, awaiting reviewer" state.
- **praise** → `agentAcknowledged` — the worker reacted 🎉 and resolved; never shown.
- **No worker verdict yet:** the user replied last → `awaitingReviewer`; the reviewer
  had the last word → `notYetReviewed` ("No feedback yet" — the worker hasn't judged it).
- A thread scan error → `agentError`.

There are no PR-level rollups: each item produces a placement row (`placements.ts`),
and a PR's lane ordering is its single `sortRank` (`prSortRank` — its most-urgent
placement). Whether a PR "needs you" is simply whether it has any placement in the
`needs` lane.

## Dashboard lanes — server-authoritative routing [tested: `placements.placementsFor` in test/placements.test.ts; `adapt.buildLanes` in test/adapt.test.ts]
The unit of placement is the **item** (a thread, or a PR-health signal), NOT the PR
card — but routing is decided server-side. The daemon (`placements.ts`/`placementsFor`)
emits one placement row per (PR, lane, item); a PR in several lanes is several rows. The
frontend (`adapt.ts`/`buildLanes`) FILTERS those rows into lanes and applies the
client-only overlays (the SSE in-flight set + the staged/dispatched "cart"); it derives
no routing. The card is a pure renderer of the `items` it's handed. Lane membership
(`LANE_OF_DISPOSITION`):
- **Needs you:** `needsYourApproval` + `agentError` threads; the branch/JIRA
  pseudo-dispositions `jiraNeeded`, `branchOutOfSync`, and
  `branchConflict` (a standing conflict lives here until a rebase worker is actually in
  flight). A staged approval moves OUT the instant its Run fires (the client
  `isDispatched` overlay → In progress).
- **In progress:** `notYetReviewed` + `agentWorking`; plus client overlays — a
  `dispatched` thread (optimistic Run) and a `branchConflict` only while a rebase worker
  is in flight (`isRebasing`). Calm card + a pulsing "Agent working" cue. (Behind-base /
  CI are decorative pills, not routing signals.)
- **Waiting on reviewer:** `agentAutoFixed` + `awaitingReviewer` threads — the agent
  addressed it; the reviewer is the next actor. `agentAcknowledged` (praise) is shown
  in no lane.
