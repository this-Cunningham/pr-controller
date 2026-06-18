# pr-controller — behavior specification

The authoritative statement of what this system should do. Deterministic rules
marked **[tested]** are locked by `test/rules.test.mjs`; judgment rules marked
**[prompt]** live in `worker-prompt.md` and are enforced by the worker model.

## Purpose
Watch all of the user's open PRs across the enterprise and, per PR, dispatch a
headless Claude worker to address reviewer feedback, fix CI, and rebase — while
surfacing anything needing the user's judgment to a localhost dashboard. The user
should rarely babysit PRs; they intervene only on disagreements and decisions.

## Architecture
- One persistent Node daemon (`server.mjs`) on the user's awake laptop. It dies on
  sleep/reboot by design — this is a drive-it-during-work tool, not a service.
- Every 30 min it polls (pure Node + `gh`, no Claude), diffs against last poll, and
  dispatches a worker only for PRs that changed.
- Workers are headless `claude -p`, one durable session per PR (resumed across
  rounds), running in a per-PR git worktree.
- A dashboard (http://localhost:4317) renders all PRs; those needing the user float
  to the top.

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
- branch health changed AND there is health work (behind-base when approved, or
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

## Worker context model
- **First run** (new session): full `worker-prompt.md` rules + the PR diff, to build
  durable understanding. Receives all currently-open dispatchable threads.
- **Resume** (later polls): a short delta preamble + only the NEW threads. Relies on
  session memory for prior context; re-grounds volatile state via `git pull
  --ff-only` and `git diff <lastSeenSha>..HEAD`.
- Rules/diff are sent ONCE at session birth, never re-injected. Editing
  `worker-prompt.md` only affects new sessions; existing sessions must be
  invalidated (delete their `sessions.json` entry) to pick up changes.

## Response taxonomy [prompt]
For each unresolved reviewer-authored thread, exactly one:
- **fix** (includes minor nits — nits are actionable): make the change, reply
  `fixed` (lowercase, exact), then resolve. Only after the fix is pushed.
- **praise** (positive, nothing to change): add a 🎉 `hooray` reaction, no text,
  then resolve.
- **surface** (disagreement or needs the user's judgment): do nothing to the thread
  — no reply, no reaction, no resolve. Record why, with code citations.

Rules: never post curt text like "ack"/"ok"/"thanks" (react instead); never reply
`fixed` without an actual pushed fix; resolve every fixed/praised thread; never
resolve a surfaced thread.

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
- **Rebase** only when the PR is approved [tested] (`rebaseAllowed`). Clean rebase →
  push with `--force-with-lease`. Conflicts not trivially resolvable → surface,
  never guess through a messy merge.

## Worktrees & git safety
- Reuse the user's existing local clones, discovered under `~/cargurus` by git
  remote (not directory name) [tested: `repoSlug`], recursively to depth 2.
  Duplicate slugs prefer the shallowest (standalone) clone over nested workspace
  copies. Clone into `worktrees/<repo>.git` only if not found locally.
- One worktree per PR, off the existing clone, kept until merge.
- Decision tree: existing managed worktree → resume + `pull --ff-only` (surface if it
  can't fast-forward). Branch checked out clean elsewhere → reuse it. Branch checked
  out DIRTY elsewhere → `--detach` worktree at the branch tip, push `HEAD:<branch>`;
  never stash. Not checked out → fresh worktree on the branch.

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
