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
//  - The whole-poll guard (`polling` in server.mjs) is orthogonal: it serializes
//    SCANS; this serializes WORKERS.
//
// Dependencies are injected via init() so the drain logic stays unit-testable
// and we avoid a cycle with server.mjs (which owns refreshOnePR).

import { existsSync } from 'node:fs';
import { mergePending, classifyWorkerError, shouldRetryWorker } from './rules.mjs';
import { logger } from './log.mjs';

const log = logger('dispatch');
let deps = null;
// prKey -> { running, pr, threads: Map<threadId,thread>, approved: Set<threadId>, rebase, ci, opts }
//   rebase: a rebase is pending for the next run — either folded into thread/CI
//   work (rebaseOnConflict) or a standalone user-initiated rebase (enqueueRebase).
//   ci: a newly-failing-CI feedback run is pending with NO review threads — like
//   rebase, it must still fire one run (the worker fixes CI from branchHealth context).
const state = new Map();

export function init(d) { deps = d; }

function entry(prKey) {
  let e = state.get(prKey);
  if (!e) { e = { running: false, pr: null, threads: new Map(), approved: new Set(), rebase: false, ci: false, failures: 0, opts: {} }; state.set(prKey, e); }
  return e;
}

export function isWorking(prKey) { return !!state.get(prKey)?.running; }
export function pendingCount(prKey) {
  const e = state.get(prKey);
  return e ? e.threads.size : 0;
}

// Drop a PR's dispatch state entirely — called by the server's cleanup when a PR
// merges/closes, so a vanished PR doesn't leave a stale idle entry in the Map
// forever. Deleting while a worker runs would drop the `running` lock — a concurrent
// enqueue mints a fresh entry and fires a SECOND worker on the same session/worktree.
// So tombstone a running entry; maybeDrain's finally reaps it once truly idle.
export function forget(prKey) {
  const e = state.get(prKey);
  if (e?.running) { e.forgotten = true; return; }
  state.delete(prKey);
}

// Shared prologue for every enqueue path. Clearing e.failed is the non-obvious bit: new work
// means the prior failure isn't the last word, so let maybeDrain retry. BUT once the circuit-
// breaker has tripped (config.workerMaxRetries consecutive failures, counted in recordFailure),
// HOLD e.failed — the PR is parked as a terminal workerFailed ("Needs you") card. Only a
// genuinely new signal (`reset`) lifts it: a human action (manual Re-run / approved approach) or
// brand-new/changed reviewer feedback. A reset also re-arms the full budget (failures=0). A
// ROUTINE re-enqueue (CI/health churn, an auto-rebase, the same unchanged thread) must NOT clear
// a tripped breaker — that infinite-retry / API-spend leak is exactly what this guards.
function enqueueEntry(pr, opts, reset = false) {
  const prKey = `${pr.repo}#${pr.number}`;
  const e = entry(prKey);
  e.pr = pr;
  e.opts = { ...e.opts, ...opts };
  if (reset) { e.failures = 0; e.failed = false; }
  else if (shouldRetryWorker(e.failures)) e.failed = false;
  return { prKey, e };
}

// Poll-found work: new/changed dispatchable threads, optionally also resolving a
// merge conflict in the same run (opts.rebaseOnConflict).
export function enqueue(pr, newThreads, opts = {}) {
  const prKey = `${pr.repo}#${pr.number}`;
  // A genuinely-new signal resets a tripped failure breaker (see enqueueEntry): an explicit
  // manual Re-run (opts.reset), or brand-new/changed reviewer feedback — a thread not already
  // staged, or one whose latest comment changed (a fresh fingerprint). A routine re-enqueue
  // (CI/health churn re-sending only already-staged, unchanged threads) is NOT, so it can trip.
  const staged = state.get(prKey)?.threads;
  const newFeedback = (newThreads || []).some((t) =>
    t?.threadId && !t.error && (!staged?.has(t.threadId) || staged.get(t.threadId).lastCommentId !== t.lastCommentId));
  const { e } = enqueueEntry(pr, opts, !!opts.reset || newFeedback);
  if (opts.rebaseOnConflict) e.rebase = true;
  // A feedback run can be warranted by failing CI alone (no review threads). Mark it so
  // the drain guard below doesn't treat an empty-thread CI run as "nothing to do" and
  // silently drop it. The poller only enqueues feedback when work CHANGED (rules.
  // dispatchDecision gates on healthChanged), so this can't hot-loop on a standing failure.
  if (opts.ci) e.ci = true;
  mergePending(e.threads, newThreads);
  maybeDrain(prKey);
}

// User-initiated standalone rebase (the manual "Rebase" CTA): no threads, just
// resolve the conflict and push. Coalesces like everything else — if a worker is
// already running for this PR, it joins the next run.
export function enqueueRebase(pr, opts = {}) {
  // The poll's auto-rebase is routine (no reset); a future manual Rebase CTA can pass opts.reset.
  const { prKey, e } = enqueueEntry(pr, opts, !!opts.reset);
  e.rebase = true;
  maybeDrain(prKey);
}

// User-approved approaches: resolve threadIds against the PR's current
// threads, stage them as apply-approved, and (auto-)fire on the next free slot.
export function enqueueApproved(pr, threadIds, opts = {}) {
  // A user-approved approach is an explicit human "go" — a genuinely new signal that resets a
  // tripped failure breaker (like a manual Re-run), not a routine re-enqueue.
  const { prKey, e } = enqueueEntry(pr, opts, true);
  const byId = new Map((pr.threads || []).map((t) => [t.threadId, t]));
  const approvedThreads = (threadIds || []).map((id) => byId.get(id)).filter(Boolean);
  mergePending(e.threads, approvedThreads);
  for (const t of approvedThreads) e.approved.add(t.threadId);
  maybeDrain(prKey);
}

// Run the pending batch if this PR is free; on completion, refresh it and drain
// again so anything that arrived mid-run goes out in the next batch (coalescing).
async function maybeDrain(prKey) {
  const e = state.get(prKey);
  // Fire when there's ANY pending work: threads OR a pending rebase OR a newly-failing-CI
  // run. (Earlier this bailed on zero threads, which silently dropped health-only/rebase-
  // only and CI-only runs.) `e.failed` blocks only the AUTO re-fire after a throw —
  // refiring the re-staged batch (see catch) immediately would hot-loop on a hard failure.
  // The next enqueue clears it — until the breaker trips (recordFailure), after which only a
  // reset signal does (enqueueEntry), so a chronically-failing PR parks instead of looping.
  if (!e || e.running || e.failed || (e.threads.size === 0 && !e.rebase && !e.ci)) return;

  e.running = true;
  // Optimistically clear any prior worker-failure surface — this run is a fresh attempt. If it
  // throws (e.g. a transport/clone failure) the catch re-sets it; if it succeeds it stays clear.
  deps.markAgentError?.(prKey, null);
  const pr = e.pr;
  const drainedThreads = [...e.threads.values()];
  const applyApproved = e.approved.size > 0;
  const rebase = e.rebase;
  // A PURE rebase run (resolve a conflict, NO threads) is governed by dispatchDecision
  // (rebaseSurfaced / healthChanged), NOT this feedback retry breaker. Exempt it: an erroring
  // rebase still surfaces + re-stages (Phase 1, unchanged) but never increments/trips the cap, and
  // a clean rebase doesn't reset the feedback streak. So rebase behavior is unchanged. (A
  // rebase BUNDLED with threads — rebaseOnConflict — still counts; it's doing feedback work.)
  const rebaseOnly = rebase && drainedThreads.length === 0;
  const opts = { ...e.opts };
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
  const recordFailure = (reason) => {
    // Count toward the circuit-breaker for feedback/CI work only; a rebase-only run is exempt
    // (its retry suppression lives in dispatchDecision), so it surfaces + re-stages but never caps.
    if (!rebaseOnly) e.failures += 1;
    const tripped = !rebaseOnly && !shouldRetryWorker(e.failures);
    // Augment the log (don't replace the per-reason warnings above) so a tripped breaker is
    // visible in the daemon log, not just on the card.
    if (tripped) log.warn(`${prKey}: worker failed ${e.failures}x (>= workerMaxRetries) — tripping retry breaker; parking as Needs-you until a new signal (manual Re-run or fresh feedback)`);
    deps.markAgentError?.(prKey, tripped
      ? `${reason} (kept failing after ${e.failures} attempts — re-run to try again)`
      : reason);
    mergePending(e.threads, drainedThreads);
    if (applyApproved) for (const t of drainedThreads) e.approved.add(t.threadId);
    if (rebase) e.rebase = true;
    e.failed = true;
  };

  deps.events.markStarted(prKey, { rebase });
  const outPath = deps.outPath(pr);
  try {
    // If the last run for this PR didn't finish cleanly (worker killed on shutdown, or
    // a daemon crash left the durable flag set), tell ensureWorktree to hard-reset our
    // managed worktree first, and tell the worker its run is a recovered resume.
    const recover = deps.isInterrupted ? await deps.isInterrupted(prKey) : false;
    const wt = await deps.ensureWorktree(pr, { recover });
    if (wt.outOfSync) {
      pr.outOfSync = true;
      deps.markOutOfSync?.(prKey, true);
      log.info(`${prKey}: branch out of sync, surfacing instead of launching`);
    } else {
      deps.markOutOfSync?.(prKey, false);  // synced cleanly — clear any prior flag
      const r = await deps.runWorker(pr, drainedThreads, wt.path, outPath, {
        detached: wt.detached, pushRefspec: wt.pushRefspec,
        branchHealth: opts.branchHealth, rebase,
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
        } else if (!rebaseOnly) {
          e.failures = 0;  // a clean feedback/CI result ends the streak — re-arm the budget (rebase-only is exempt)
        }
      }
    }
  } catch (err) {
    // A worker-run failure (commonly a git transport/clone/push error) otherwise vanishes into
    // this log line. Classify it and route it through the shared failure path (surface + re-stage).
    log.error(`${prKey}: worker run failed`, err.message);
    recordFailure(classifyWorkerError(err.message));
  } finally {
    e.running = false;
    // `pending` = a queued batch runs NEXT, so the client keeps its optimistic "dispatched"
    // overlay instead of reverting a still-applying approval to "Approve". A re-staged-but-
    // gated (failed) batch isn't progressing, so exclude it and let the overlay clear.
    deps.events.markFinished(prKey, { pending: (e.threads.size > 0 || e.rebase) && !e.failed });
    try { await deps.refreshOnePR(prKey); } catch (err) { log.error(`${prKey}: refresh failed`, err.message); }
    // Coalesce: drain anything that arrived while we were busy.
    maybeDrain(prKey);
    // Reap a tombstoned entry (see forget()). The maybeDrain above set running=true
    // synchronously if it re-fired, so this only deletes a truly-idle forgotten entry.
    if (e.forgotten && !e.running && e.threads.size === 0 && !e.rebase) state.delete(prKey);
  }
}
