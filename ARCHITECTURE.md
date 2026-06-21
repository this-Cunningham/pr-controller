# Architecture — pr-controller

A local, single-user Node daemon that watches your open GitHub PRs and dispatches
headless Claude workers to handle reviewer feedback, CI, and rebases — surfacing only
what needs your judgment to a localhost dashboard.

This doc is HOW the system is built. For WHAT it should do (behavior rules), see
[SPEC.md](SPEC.md).

## The core principle: the daemon is server-authoritative for routing

> **The daemon decides which lane every item of a PR belongs to. The frontend derives
> no routing — it FILTERS the daemon's decisions and renders them.**

Routing lives in exactly one pure, tested function: `placementsFor` in `placements.mjs`.
If you are tempted to compute "which tab does this go in?" in the React app, stop — that
decision belongs in `placements.mjs`.

## Lanes are for items; PR-level state is a badge

A lane (Needs you / In progress / Waiting on reviewer) is a destination for an **item** —
a thread or a branch signal that needs a next action. A status that is true of a **whole
PR** (its review or merge state — e.g. approved, or ready to merge) is a **badge** on the
card, never a lane.

The reason is the placement model itself: a lane classifies items, so a PR appears in a
lane because it *has an item there*. A PR-level status has no item to attach to — making
it a lane would force the PR to be classified twice along two unrelated axes at once (a
whole-PR reason competing with its item-level reasons), which is the ambiguity the
placement model exists to remove.

Rule of thumb: if a signal is a property of the PR rather than of one actionable item,
render it as a badge (or a header filter/sort) — not a lane.

## The pipeline (by file)

Each hop is small, pure where it can be, and tested:

1. **`scanner.mjs`** — `gh`-only, no Claude. Lists your open PRs (`gh search prs
   --author @me`), filters to `config.onlyPRs`, and per PR fetches unresolved review
   threads, `mergeable`/`mergeStateStatus`, `baseRefName`, and the CI rollup. Raw
   GitHub data, no opinions.
2. **`rules.mjs`** — pure decision logic, no I/O (tested: `test/rules.test.mjs`):
   `deriveDisposition` (per-thread verdict from the worker's `response`), `dispatchable`
   / `dispatchDecision` / `nextSeenThreads` (when a worker runs; how a conflict defers
   threads), `isWorkerResultStale` (whether a persisted verdict is stale).
3. **`derive.mjs`** — `deriveRecord(pr, { workerResult, outOfSync })`, pure (tested:
   `test/derive.test.mjs`). Builds the canonical per-PR record: each thread's
   disposition + branch flags (`needsRebase`/`outOfSync`/`workerSurfaced`) + `needsJira`.
   THE place where raw scan + stored worker verdict become "everything known about this PR."
4. **`placements.mjs`** — `placementsFor`, `LANE_OF_DISPOSITION`, `DISPOSITION_RANK`,
   `prSortRank`, pure (tested: `test/placements.test.mjs`). **The single source of truth
   for routing.** Maps each item to a lane and emits flat placement rows.
5. **`server.mjs`** — the persistent `node:http` daemon. Polls on an interval, runs
   `deriveAndSetPrFields` (reads the worker verdict file + calls `deriveRecord`),
   computes placements, writes `state.json`. Per-PR ordering is the single `sortRank`.
   Serves the built dashboard + `/state.json` + `/events` (SSE) + `/decision` + `/poll`.
6. **`dispatcher.mjs` / `worker.mjs` / `worktree.mjs`** — per-PR worker serialization
   (one in-flight worker per PR, a coalescing pending set); the headless `claude -p`
   worker runs in a per-PR git worktree.
7. **`pr-controller-react/src/features/dashboard/adapt.js`** — `buildLanes(prs,
   placements, overlays)` FILTERS the placement rows into the three lanes, applies
   client-only overlays, and builds the render `items`. `PRCard` is a pure renderer of
   `items` (tested: `test/adapt.test.mjs`).

## The wire: `state.json`

```jsonc
{
  "updatedAt": "ISO",
  "scope": ["repo#1"],                       // config.onlyPRs
  "lanes": ["needs", "progress", "waiting"],
  "prs": [ { repo, number, title, url, isDraft, reviewDecision,
             behindBase, needsRebase, outOfSync, workerSurfaced, needsJira,
             branchHealth: { failingChecks[] }, sortRank,
             threads: [ { threadId, path, line, author, lastAuthor, body,
                          disposition, reason, suggestedReply?, suggestedApproach?, error? } ] } ],
  "placements": [ { prKey, lane, subjectKind, subjectId, disposition, reason, sortRank } ]
}
```

A **placement** is one `(prKey, lane, subjectKind, subjectId, disposition, reason,
sortRank)` row. **A PR in several lanes is several rows — the split is DATA, not
per-render logic.**

## Disposition vocabulary

A **disposition** is the per-item verdict. Per-thread (from `deriveDisposition`):

| disposition        | lane     | meaning                                        |
|--------------------|----------|------------------------------------------------|
| `needsYourApproval`| needs    | agent surfaced it for your judgment            |
| `agentError`       | needs    | thread scan error                              |
| `notYetReviewed`   | progress | reviewer spoke last; agent hasn't judged yet   |
| `agentAutoFixed`   | waiting  | agent changed code + replied `fixed`           |
| `awaitingReviewer` | waiting  | you replied last                               |
| `agentAcknowledged`| (none)   | praise — shown in **no** lane                  |

Non-thread pseudo-dispositions (from `placementsFor`):

| disposition       | lane     | subject                                        |
|-------------------|----------|------------------------------------------------|
| `jiraNeeded`      | needs    | missing JIRA ticket (compliance check)         |
| `branchOutOfSync` | needs    | branch diverged; agent never ran               |
| `branchConflict`  | needs    | merge conflict (carries the agent's reason if it surfaced one) |
| `agentWorking`    | progress | a worker is in flight (no other progress row)  |

The client maps each disposition to the design-system short tag
(`input | fixed | waiting | pending | praise | error`) via `DISPOSITION_TO_TAG` — for
**styling only**, never routing.

## Client-only overlays (`adapt.buildLanes`)

The daemon's placements are authoritative; the client layers three live, view-only
overlays on top (they change only which lane a card is shown in *right now*, never the
server's data):

- **`isDispatched`** — a thread you approved + Ran shows in In progress immediately
  (optimistic; `state.json` catches up when the worker exits).
- **`isWorking`** — a PR with a worker in flight (SSE in-flight set) and no other
  progress row gets a synthetic "agent working" row.
- **`isRebasing`** — a `branchConflict` lives in **Needs you**, and shows as In progress
  ("rebasing now") *only while a rebase worker is actually in flight*. A conflict no
  agent is on must never look like it's rebasing.

## Deterministic dispatch (conflict-wins)

- A merge conflict short-circuits `dispatchDecision` to a **rebase-only** run, never
  feedback.
- `nextSeenThreads` **defers** threads during a conflict (keeps them "unseen") so they
  dispatch as a feedback run the first poll *after* the conflict clears.
- The rebase worker is told to ``git fetch origin <baseRef> && git rebase
  origin/<baseRef>`` — onto the REMOTE base (a long-lived clone's local base branch lags
  `origin`).

## The design system is frozen

The Wabi-Sabi design system (baseline `design/.upstream/wabi-sabi-foundation/`,
vendored into `pr-controller-react/src/design-system/`) is brand source-of-truth. Its
components RENDER; they do not route. Keep the theme/tokens intact; don't restyle ad
hoc — sync it only via `/pull-new-designs` (mapping in `.design-sync.json`). The only
client-side translation is `DISPOSITION_TO_TAG` (disposition → DS tag) in `adapt.js`.

## Config

`config.mjs` is env-overridable so the daemon can run against a different GitHub without
editing the committed defaults: `PRC_HOST`, `PRC_OWNER`, `PRC_LOGIN`, `PRC_PORT`,
`PRC_POLL_MINUTES`, `PRC_ONLY_PRS` (`""` = all your open PRs; unset = the committed
defaults). `config.onlyPRs` is the scope primitive + circuit-breaker: a non-empty list
restricts the daemon to exactly those `repo#number` keys (everything else is invisible).
Workers run with `--permission-mode bypassPermissions` and push to real PRs, so
`onlyPRs` is the real safety valve.
