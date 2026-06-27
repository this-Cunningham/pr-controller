// Per-PR worker dispatch: lock + pending set + auto-fire coalescing drain.
//
// Why this exists: worker dispatch must run out-of-band (a `claude -p` run can take
// minutes, and the poll + the user's "Run agent" action must not block on it) AND be
// serialized per PR — two `claude -p`
// against the same session UUID + worktree would corrupt both. This module owns
// that serialization.
//
//  - One worker per PR at a time (the per-PR `running` flag is the lock).
//  - Work that arrives while a PR is busy (new poll threads OR user-approved
//    approaches) lands in that PR's pending set and AUTO-FIRES when the lock frees
//    — one re-ground + push per batch, never a double-dispatch.
//  - The whole-poll guard (`polling` in server.ts) is orthogonal: it serializes
//    SCANS; this serializes WORKERS.
//
// Dependencies are injected via init() so the drain logic stays unit-testable
// and we avoid a cycle with server.ts (which owns refreshOnePR).

import { existsSync } from 'node:fs';
import { mergePending, classifyWorkerError, shouldRetryWorker } from './rules.ts';
import { logger } from './log.ts';
import type { Pr, Thread, BranchHealth } from './types.ts';
import type { markStarted, markFinished } from './events.ts';

// Options accepted by the three enqueue* entrypoints (folded into the run flags by
// enqueueEntry). All optional — each path passes only the ones it cares about.
interface EnqueueOpts {
  branchHealth?: BranchHealth | null;
  rebaseOnConflict?: boolean;
  ci?: boolean;
  reset?: boolean;
}

// What a spawned worker run resolves to (worker.runWorker). Only the fields the
// dispatcher reads are modelled precisely; the rest of the result is irrelevant here.
interface RunResult {
  spawned: boolean;
  sessionId?: string;
  code?: number | null;
  outcome?: { ok: boolean; reason: string | null };
  tail?: string;
  reason?: string;
}

// What ensureWorktree resolves to (worktree.ensureWorktree). Same: only the fields the
// dispatcher branches on are modelled.
interface WorktreeResult {
  path: string;
  outOfSync?: boolean;
  detached?: boolean;
  pushRefspec?: string;
  recovered?: boolean;
}

// Dependencies injected via init() so the drain logic stays unit-testable and we avoid a
// cycle with server.ts (which owns refreshOnePR). runWorker/ensureWorktree/refreshOnePR/
// outPath are the daemon's real implementations; the mark*/isInterrupted hooks are optional
// (the tests inject only a subset).
interface Deps {
  events: { markStarted: typeof markStarted; markFinished: typeof markFinished };
  ensureWorktree: (pr: Pr, opts: { recover: boolean }) => Promise<WorktreeResult>;
  runWorker: (
    pr: Pr,
    newThreads: Thread[],
    worktreePath: string,
    outPath: string,
    opts: {
      detached?: boolean;
      pushRefspec?: string;
      branchHealth?: BranchHealth | null;
      rebase: boolean;
      applyApproved: boolean;
      recovered?: boolean;
    },
  ) => Promise<RunResult>;
  refreshOnePR: (prKey: string) => Promise<void>;
  outPath: (pr: Pr) => string;
  markOutOfSync?: (prKey: string, v: boolean) => void;
  markAgentError?: (prKey: string, reason: string | null) => void;
  isInterrupted?: (prKey: string) => Promise<boolean> | boolean;
}

// Per-PR dispatch state held in the `state` Map below.
interface Entry {
  running: boolean;
  pr: Pr | null;
  threads: Map<string, Thread>;
  approved: Set<string>;
  rebase: boolean;
  ci: boolean;
  failures: number;
  branchHealth?: BranchHealth | null;
  forgotten?: boolean;
  failed?: boolean;
}

const log = logger('dispatch');
let deps: Deps | null = null;
// prKey -> { running, pr, threads: Map<threadId,thread>, approved: Set<threadId>, rebase, ci, failures, branchHealth }
//   rebase: a rebase is pending for the next run — either folded into thread/CI
//   work (rebaseOnConflict) or a standalone user-initiated rebase (enqueueRebase).
//   ci: a newly-failing-CI feedback run is pending with NO review threads — like
//   rebase, it must still fire one run (the worker fixes CI from branchHealth context).
//   failures: consecutive errored-run count for the per-PR retry breaker (recordFailure /
//   rules.shouldRetryWorker); reset to 0 by a clean run or a genuinely new signal.
//   branchHealth: the latest scan's branch-health, the ONLY enqueue input the run itself
//   reads (passed to runWorker); rebase/ci are consumed at enqueue time into the flags above.
const state = new Map<string, Entry>();

export function init(d: Deps) { deps = d; }

function entry(prKey: string): Entry {
  let e = state.get(prKey);
  if (!e) { e = { running: false, pr: null, threads: new Map(), approved: new Set(), rebase: false, ci: false, failures: 0, branchHealth: null }; state.set(prKey, e); }
  return e;
}

export function isWorking(prKey: string) { return !!state.get(prKey)?.running; }
export function pendingCount(prKey: string) {
  const e = state.get(prKey);
  return e ? e.threads.size : 0;
}

// Drop a PR's dispatch state entirely — called by the server's cleanup when a PR
// merges/closes, so a vanished PR doesn't leave a stale idle entry in the Map
// forever. Deleting while a worker runs would drop the `running` lock — a concurrent
// enqueue mints a fresh entry and fires a SECOND worker on the same session/worktree.
// So tombstone a running entry; maybeDrain's finally reaps it once truly idle.
export function forget(prKey: string) {
  const e = state.get(prKey);
  if (e?.running) { e.forgotten = true; return; }
  state.delete(prKey);
}

// Shared prologue for every enqueue path. Two jobs:
// (1) Fold opts into the run flags HERE (not per-path), so the three enqueue* entrypoints can't
//     drift on which flags they respect — a past omission silently dropped rebaseOnConflict on the
//     apply-approved path. branchHealth is the run's only input; rebaseOnConflict/ci become flags.
// (2) The failure gate. Clearing e.failed lets maybeDrain retry — new work means the prior failure
//     isn't the last word. BUT once the circuit-breaker has tripped (config.workerMaxRetries
//     consecutive failures, counted in recordFailure), HOLD e.failed: the PR parks as a terminal
//     workerFailed ("Needs you") card. Only a genuinely new signal (`reset`) lifts it — a human
//     action (manual Re-run / approved approach) or brand-new/changed reviewer feedback — which
//     also re-arms the budget (failures=0). A ROUTINE re-enqueue (CI/health churn, an auto-rebase,
//     the same unchanged thread) must NOT clear a tripped breaker — that infinite-retry / API-spend
//     leak is exactly what this guards.
function enqueueEntry(pr: Pr, opts: EnqueueOpts, reset = false) {
  const prKey = `${pr.repo}#${pr.number}`;
  const e = entry(prKey);
  e.pr = pr;
  if (opts.branchHealth !== undefined) e.branchHealth = opts.branchHealth;
  if (opts.rebaseOnConflict) e.rebase = true;
  if (opts.ci) e.ci = true;
  if (reset) { e.failures = 0; e.failed = false; }
  else if (shouldRetryWorker(e.failures)) e.failed = false;
  return { prKey, e };
}

// Poll-found work: new/changed dispatchable threads, optionally also resolving a
// merge conflict in the same run (opts.rebaseOnConflict) or fixing failing CI (opts.ci).
export function enqueue(pr: Pr, newThreads: Thread[] | null | undefined, opts: EnqueueOpts = {}) {
  const prKey = `${pr.repo}#${pr.number}`;
  // A genuinely-new signal resets a tripped failure breaker (see enqueueEntry): an explicit
  // manual Re-run (opts.reset), or brand-new/changed reviewer feedback — a thread not already
  // staged, or one whose latest comment changed (a fresh fingerprint). A routine re-enqueue
  // (CI/health churn re-sending only already-staged, unchanged threads) is NOT, so it can trip.
  // (rebaseOnConflict + ci are folded into the run flags by enqueueEntry, shared across all paths.)
  const staged = state.get(prKey)?.threads;
  const newFeedback = (newThreads || []).some((t) =>
    t?.threadId && !t.error && (!staged?.has(t.threadId) || staged.get(t.threadId)?.lastCommentId !== t.lastCommentId));
  const { e } = enqueueEntry(pr, opts, !!opts.reset || newFeedback);
  mergePending(e.threads, newThreads);
  maybeDrain(prKey);
}

// User-initiated standalone rebase (the manual "Rebase" CTA): no threads, just
// resolve the conflict and push. Coalesces like everything else — if a worker is
// already running for this PR, it joins the next run.
export function enqueueRebase(pr: Pr, opts: EnqueueOpts = {}) {
  // The poll's auto-rebase is routine (no reset); a future manual Rebase CTA can pass opts.reset.
  const { prKey, e } = enqueueEntry(pr, opts, !!opts.reset);
  e.rebase = true;
  maybeDrain(prKey);
}

// User-approved approaches: resolve threadIds against the PR's current
// threads, stage them as apply-approved, and (auto-)fire on the next free slot.
export function enqueueApproved(pr: Pr, threadIds: string[] | null | undefined, opts: EnqueueOpts = {}) {
  // A user-approved approach is an explicit human "go" — a genuinely new signal that resets a
  // tripped failure breaker (like a manual Re-run), not a routine re-enqueue.
  const { prKey, e } = enqueueEntry(pr, opts, true);
  const byId = new Map((pr.threads || []).map((t) => [t.threadId, t] as const));
  const approvedThreads = (threadIds || [])
    .map((id) => byId.get(id))
    .filter((t): t is Thread => Boolean(t));
  mergePending(e.threads, approvedThreads);
  for (const t of approvedThreads) e.approved.add(t.threadId);
  maybeDrain(prKey);
}

// Run the pending batch if this PR is free; on completion, refresh it and drain
// again so anything that arrived mid-run goes out in the next batch (coalescing).
async function maybeDrain(prKey: string) {
  const e = state.get(prKey);
  // Fire when there's ANY pending work: threads OR a pending rebase OR a newly-failing-CI
  // run. (Earlier this bailed on zero threads, which silently dropped health-only/rebase-
  // only and CI-only runs.) `e.failed` blocks only the AUTO re-fire after a throw —
  // refiring the re-staged batch (see catch) immediately would hot-loop on a hard failure.
  // The next enqueue clears it — until the breaker trips (recordFailure), after which only a
  // reset signal does (enqueueEntry), so a chronically-failing PR parks instead of looping.
  if (!e || e.running || e.failed || (e.threads.size === 0 && !e.rebase && !e.ci)) return;
  // init() is always called before any enqueue (server.ts / tests), so deps is set by the
  // time we drain; the `!` asserts that without adding a runtime check.
  const d = deps!;

  e.running = true;
  // Optimistically clear any prior worker-failure surface — this run is a fresh attempt. If it
  // throws (e.g. a transport/clone failure) the catch re-sets it; if it succeeds it stays clear.
  d.markAgentError?.(prKey, null);
  // Every enqueue* path sets e.pr before staging work, so a drained entry always has one (the
  // `!` asserts that; it adds no runtime check, preserving behavior).
  const pr = e.pr!;
  const drainedThreads = [...e.threads.values()];
  const applyApproved = e.approved.size > 0;
  const rebase = e.rebase;
  const ci = e.ci;
  const branchHealth = e.branchHealth;
  e.threads = new Map();
  e.approved = new Set();
  e.rebase = false;
  e.ci = false;  // one-shot, like rebase — consumed so the post-run re-drain can't loop

  // One home for "this run did not produce a clean result" — shared by a THROWN run (git
  // transport/clone/push, caught below) and a run that spawned but came back unusable (non-zero
  // exit, refusal, token-cutoff, no/garbage result file — r.outcome from runWorker). Both must
  // (a) surface a durable workerFailed card and (b) re-stage the consumed batch: the poller
  // already marked these threads "seen" (server.poll), so without a re-stage they'd strand
  // un-judged. `e.failed` gates the auto-retry so a hard failure can't hot-loop; the next
  // enqueue clears it — UNLESS the breaker has now tripped (e.failures hit the cap), in which
  // case the surface becomes terminal and only a new signal lifts it (see enqueueEntry).
  const recordFailure = (reason: string | null) => {
    // Every errored run counts toward the per-PR breaker — feedback, CI, AND an errored rebase
    // (a worker-run failure, distinct from a deliberate rebaseSurfaced, which is a CLEAN run that
    // never lands here). dispatchDecision re-attempts an errored conflict each poll; this bounds it.
    e.failures += 1;
    const tripped = !shouldRetryWorker(e.failures);
    // Augment the log (don't replace the per-reason warnings above) so a tripped breaker is
    // visible in the daemon log, not just on the card.
    if (tripped) log.warn(`${prKey}: worker failed ${e.failures}x (>= workerMaxRetries) — tripping retry breaker; parking as Needs-you until a new signal (manual Re-run or fresh feedback)`);
    d.markAgentError?.(prKey, tripped
      ? `${reason} (kept failing after ${e.failures} attempts — re-run to try again)`
      : reason);
    mergePending(e.threads, drainedThreads);
    if (applyApproved) for (const t of drainedThreads) e.approved.add(t.threadId);
    if (rebase) e.rebase = true;
    if (ci) e.ci = true;   // restore the CI-only reason too, else a failed CI-fix run never auto-retries
    e.failed = true;
  };

  d.events.markStarted(prKey, { rebase });
  const outPath = d.outPath(pr);
  try {
    // If the last run for this PR didn't finish cleanly (worker killed on shutdown, or
    // a daemon crash left the durable flag set), tell ensureWorktree to hard-reset our
    // managed worktree first, and tell the worker its run is a recovered resume.
    const recover = d.isInterrupted ? await d.isInterrupted(prKey) : false;
    const wt = await d.ensureWorktree(pr, { recover });
    if (wt.outOfSync) {
      pr.outOfSync = true;
      d.markOutOfSync?.(prKey, true);
      log.info(`${prKey}: branch out of sync, surfacing instead of launching`);
    } else {
      d.markOutOfSync?.(prKey, false);  // synced cleanly — clear any prior flag
      const r = await d.runWorker(pr, drainedThreads, wt.path, outPath, {
        detached: wt.detached, pushRefspec: wt.pushRefspec,
        branchHealth, rebase,
        applyApproved, recovered: wt.recovered,
      });
      log.info(`${prKey}: ${drainedThreads.length} thread(s)${applyApproved ? ' (apply-approved)' : ''}${rebase ? ' +rebase' : ''} -> `
        + (r.spawned ? `session ${r.sessionId} (exit ${r.code})` : r.reason));
      // Surface what the headless worker actually did: its stdout tail (debug — the
      // FULL transcript is now persisted to data/worker-<repo>-<num>.log), and whether
      // it wrote the result JSON. A missing file after a "spawned" run = the worker
      // errored/no-op'd (e.g. phantom --resume); the .log says why.
      if (r.spawned) {
        if (r.tail) log.debug(`worker ${prKey} tail`, r.tail.trim());
        if (!existsSync(outPath)) log.warn(`worker ${prKey}: no result JSON at ${outPath} — took no action (errored or empty run); see the .log transcript`);
        // A run that spawned but came back without a clean, usable result (non-zero exit,
        // refusal, token-cutoff, no/garbage file) resolves normally — it never throws — so route
        // it through the SAME surface-and-retry path as a thrown run instead of letting its
        // threads silently revert to "not yet reviewed".
        if (r.outcome && !r.outcome.ok) {
          log.warn(`${prKey}: worker run did not produce a clean result — ${r.outcome.reason}`);
          recordFailure(r.outcome.reason);
        } else {
          e.failures = 0;  // a clean result (incl. a resolved/surfaced rebase) ends the streak — re-arm the budget
        }
      }
    }
  } catch (err) {
    // A worker-run failure (commonly a git transport/clone/push error) otherwise vanishes into
    // this log line. Classify it and route it through the shared failure path (surface + re-stage).
    const message = err instanceof Error ? err.message : String(err);
    log.error(`${prKey}: worker run failed`, message);
    recordFailure(classifyWorkerError(message));
  } finally {
    e.running = false;
    // `pending` = a queued batch runs NEXT, so the client keeps its optimistic "dispatched"
    // overlay instead of reverting a still-applying approval to "Approve". A re-staged-but-
    // gated (failed) batch isn't progressing, so exclude it and let the overlay clear.
    d.events.markFinished(prKey, { pending: (e.threads.size > 0 || e.rebase) && !e.failed });
    try { await d.refreshOnePR(prKey); } catch (err) { log.error(`${prKey}: refresh failed`, err instanceof Error ? err.message : String(err)); }
    // Coalesce: drain anything that arrived while we were busy.
    maybeDrain(prKey);
    // Reap a tombstoned entry (see forget()). The maybeDrain above set running=true
    // synchronously if it re-fired, so this only deletes a truly-idle forgotten entry.
    if (e.forgotten && !e.running && e.threads.size === 0 && !e.rebase) state.delete(prKey);
  }
}
