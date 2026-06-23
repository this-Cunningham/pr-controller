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
// forever. Safe to call after a run completes (the PR has no more work); a PR that
// is still running gets re-created on its next enqueue if it somehow reappears.
export function forget(prKey) { state.delete(prKey); }

// Poll-found work: new/changed dispatchable threads, optionally also resolving a
// merge conflict in the same run (opts.rebaseOnConflict).
export function enqueue(pr, newThreads, opts = {}) {
  const prKey = `${pr.repo}#${pr.number}`;
  const e = entry(prKey);
  e.pr = pr;
  e.opts = { ...e.opts, ...opts };
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
  if (!e || e.running || (e.threads.size === 0 && !e.rebase)) return;

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
  } finally {
    e.running = false;
    deps.events.markFinished(prKey);
    try { await deps.refreshOnePR(prKey); } catch (err) { log.error(`${prKey}: refresh failed`, err.message); }
    // Coalesce: drain anything that arrived while we were busy.
    maybeDrain(prKey);
  }
}
