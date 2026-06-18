// Per-PR worker dispatch: lock + pending set + auto-fire coalescing drain.
//
// Why this exists: poll() used to ensureWorktree()+runWorker() inline and block
// the whole poll. With live status (SSE) and the user's "Run agent" (Phase 2),
// dispatches must run out-of-band AND be serialized per PR — two `claude -p`
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
import { mergePending } from './rules.mjs';

let deps = null;
// prKey -> { running, pr, threads: Map<threadId,thread>, approved: Set<threadId>, opts }
const state = new Map();

export function init(d) { deps = d; }

function entry(prKey) {
  let e = state.get(prKey);
  if (!e) { e = { running: false, pr: null, threads: new Map(), approved: new Set(), opts: {} }; state.set(prKey, e); }
  return e;
}

export function isWorking(prKey) { return !!state.get(prKey)?.running; }
export function pendingCount(prKey) {
  const e = state.get(prKey);
  return e ? e.threads.size : 0;
}

// Poll-found work: new/changed dispatchable threads + (maybe) branch-health work.
export function enqueue(pr, newThreads, opts = {}) {
  const prKey = `${pr.repo}#${pr.number}`;
  const e = entry(prKey);
  e.pr = pr;
  e.opts = { ...e.opts, ...opts };
  mergePending(e.threads, newThreads);
  maybeDrain(prKey);
}

// User-approved approaches (Phase 2): resolve threadIds against the PR's current
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
  if (!e || e.running || e.threads.size === 0) return;

  e.running = true;
  const pr = e.pr;
  const drainedThreads = [...e.threads.values()];
  const applyApproved = e.approved.size > 0;
  const opts = { ...e.opts };
  e.threads = new Map();
  e.approved = new Set();

  deps.events.markStarted(prKey);
  const outPath = deps.outPath(pr);
  try {
    const wt = await deps.ensureWorktree(pr);
    if (wt.outOfSync) {
      pr.outOfSync = true;
      console.log(`[dispatch] ${prKey}: branch out of sync, surfacing instead of launching`);
    } else {
      const r = await deps.runWorker(pr, drainedThreads, wt.path, outPath, {
        detached: wt.detached, pushRefspec: wt.pushRefspec,
        branchHealth: opts.branchHealth, rebaseAllowed: opts.rebaseAllowed,
        applyApproved,
      });
      console.log(`[dispatch] ${prKey}: ${drainedThreads.length} thread(s)${applyApproved ? ' (apply-approved)' : ''} ->`,
        r.spawned ? `session ${r.sessionId} (exit ${r.code})` : r.reason, wt.plan || '');
      // Surface what the headless worker actually did: its stdout tail, and
      // whether it wrote the result JSON. A missing file after a "spawned" run =
      // the worker errored/no-op'd (e.g. phantom --resume).
      if (r.spawned) {
        if (r.tail) console.log(`[worker ${prKey}] tail:`, r.tail.trim());
        if (!existsSync(outPath)) console.warn(`[worker ${prKey}] WARN: no result JSON at ${outPath} — worker took no action (errored or empty run)`);
      }
    }
  } catch (err) {
    console.error(`[dispatch] ${prKey}: worker run failed:`, err.message);
  } finally {
    e.running = false;
    deps.events.markFinished(prKey);
    try { await deps.refreshOnePR(prKey); } catch (err) { console.error(`[dispatch] ${prKey}: refresh failed:`, err.message); }
    // Coalesce: drain anything that arrived while we were busy.
    maybeDrain(prKey);
  }
}
