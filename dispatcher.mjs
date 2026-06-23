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
//    — one re-ground + push per batch, never a double-dispatch. (plan §295-317)
//  - The whole-poll guard (`polling` in server.mjs) is orthogonal: it serializes
//    SCANS; this serializes WORKERS.
//
// Dependencies are injected via init() so the drain logic stays unit-testable
// and we avoid a cycle with server.mjs (which owns refreshOnePR).

import { existsSync } from 'node:fs';
import { mergePending, classifyWorkerError } from './rules.mjs';
import { logger } from './log.mjs';

const log = logger('dispatch');
let deps = null;
// prKey -> { running, pr, threads: Map<threadId,thread>, approved: Set<threadId>, rebase, opts }
//   rebase: a rebase is pending for the next run — either folded into thread/CI
//   work (rebaseOnConflict) or a standalone user-initiated rebase (enqueueRebase).
const state = new Map();

export function init(d) { deps = d; }

function entry(prKey) {
  let e = state.get(prKey);
  if (!e) { e = { running: false, pr: null, threads: new Map(), approved: new Set(), rebase: false, opts: {} }; state.set(prKey, e); }
  return e;
}

export function isWorking(prKey) { return !!state.get(prKey)?.running; }
export function pendingCount(prKey) {
  const e = state.get(prKey);
  return e ? e.threads.size : 0;
}

// Drop a PR's dispatch state entirely — called by the server's cleanup when a PR
// merges/closes, so a vanished PR doesn't leave a stale idle entry in the Map
// forever. If a worker is STILL RUNNING for this PR, deleting the entry would drop the
// `running` lock: a concurrent enqueue would mint a fresh entry (running=false) and
// maybeDrain would fire a SECOND worker on the same session UUID + worktree, corrupting
// both. So tombstone a running entry instead and reap it in maybeDrain's finally once
// the run is truly done (idle). A PR that reappears later re-creates its entry on enqueue.
export function forget(prKey) {
  const e = state.get(prKey);
  if (e?.running) { e.forgotten = true; return; }
  state.delete(prKey);
}

// Poll-found work: new/changed dispatchable threads, optionally also resolving a
// merge conflict in the same run (opts.rebaseOnConflict).
export function enqueue(pr, newThreads, opts = {}) {
  const prKey = `${pr.repo}#${pr.number}`;
  const e = entry(prKey);
  e.pr = pr;
  e.opts = { ...e.opts, ...opts };
  e.failed = false;   // new work — clear the post-failure auto-fire gate so it retries
  if (opts.rebaseOnConflict) e.rebase = true;
  mergePending(e.threads, newThreads);
  maybeDrain(prKey);
}

// User-initiated standalone rebase (the manual "Rebase" CTA): no threads, just
// resolve the conflict and push. Coalesces like everything else — if a worker is
// already running for this PR, it joins the next run.
export function enqueueRebase(pr, opts = {}) {
  const prKey = `${pr.repo}#${pr.number}`;
  const e = entry(prKey);
  e.pr = pr;
  e.opts = { ...e.opts, ...opts };
  e.failed = false;   // new work — clear the post-failure auto-fire gate so it retries
  e.rebase = true;
  maybeDrain(prKey);
}

// User-approved approaches: resolve threadIds against the PR's current
// threads, stage them as apply-approved, and (auto-)fire on the next free slot.
export function enqueueApproved(pr, threadIds, opts = {}) {
  const prKey = `${pr.repo}#${pr.number}`;
  const e = entry(prKey);
  e.pr = pr;
  e.opts = { ...e.opts, ...opts };
  e.failed = false;   // new work — clear the post-failure auto-fire gate so it retries
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
  // Fire when there's ANY pending work: threads OR a pending rebase. (Earlier this
  // bailed on zero threads, which silently dropped health-only/rebase-only runs.)
  // `e.failed` gates the AUTO re-fire after a run threw: the failed batch was re-staged
  // (see catch), but refiring it immediately would hot-loop on a hard-repeating failure.
  // The next genuine enqueue clears the flag and retries the now-merged batch.
  if (!e || e.running || e.failed || (e.threads.size === 0 && !e.rebase)) return;

  e.running = true;
  // Optimistically clear any prior worker-failure surface — this run is a fresh attempt. If it
  // throws (e.g. a transport/clone failure) the catch re-sets it; if it succeeds it stays clear.
  deps.markAgentError?.(prKey, null);
  const pr = e.pr;
  const drainedThreads = [...e.threads.values()];
  const applyApproved = e.approved.size > 0;
  const rebase = e.rebase;
  const opts = { ...e.opts };
  e.threads = new Map();
  e.approved = new Set();
  e.rebase = false;

  deps.events.markStarted(prKey, { rebase });
  const outPath = deps.outPath(pr);
  try {
    const wt = await deps.ensureWorktree(pr);
    if (wt.outOfSync) {
      pr.outOfSync = true;
      deps.markOutOfSync?.(prKey, true);
      log.info(`${prKey}: branch out of sync, surfacing instead of launching`);
    } else {
      deps.markOutOfSync?.(prKey, false);  // synced cleanly — clear any prior flag
      const r = await deps.runWorker(pr, drainedThreads, wt.path, outPath, {
        detached: wt.detached, pushRefspec: wt.pushRefspec,
        branchHealth: opts.branchHealth, rebase,
        applyApproved,
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
      }
    }
  } catch (err) {
    // A worker-run failure (commonly a git transport/clone/push error) otherwise vanishes into
    // this log line. Classify it and stash a durable per-PR surface so the dashboard shows it.
    log.error(`${prKey}: worker run failed`, err.message);
    deps.markAgentError?.(prKey, classifyWorkerError(err.message));
    // Re-stage the batch this run consumed so a transient failure doesn't permanently
    // strand the work (the threads were already marked "seen" by the poller, so they
    // won't re-enqueue on their own). `e.failed` stops the finally's maybeDrain from
    // hot-looping on a hard-repeating failure; the next enqueue clears it and retries.
    mergePending(e.threads, drainedThreads);
    if (applyApproved) for (const t of drainedThreads) e.approved.add(t.threadId);
    if (rebase) e.rebase = true;
    e.failed = true;
  } finally {
    e.running = false;
    // `pending` tells the client whether a queued batch will run NEXT for this PR, so it
    // keeps an optimistic "dispatched" overlay alive instead of snapping a still-applying
    // approval back to "Approve". Exclude the failed case: a re-staged-but-gated batch is
    // NOT actively progressing, so the overlay should clear and reveal the real state.
    deps.events.markFinished(prKey, { pending: (e.threads.size > 0 || e.rebase) && !e.failed });
    try { await deps.refreshOnePR(prKey); } catch (err) { log.error(`${prKey}: refresh failed`, err.message); }
    // Coalesce: drain anything that arrived while we were busy.
    maybeDrain(prKey);
    // Reap a tombstoned (forgotten-while-running) entry now that the run is done and
    // nothing re-fired — see forget(). maybeDrain set running=true synchronously if it
    // re-fired, so this only deletes a truly-idle forgotten entry.
    if (e.forgotten && !e.running && e.threads.size === 0 && !e.rebase) state.delete(prKey);
  }
}
