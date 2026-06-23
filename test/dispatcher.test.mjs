// Locks the dispatcher's rebase-only path for auto-rebasing idle conflicts: an
// enqueueRebase with NO threads must still fire one worker run with rebase:true.
// Deps are injected, so no real git/worker spawns.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as dispatcher from '../dispatcher.mjs';

function harness() {
  const runs = [];
  const events = { markStarted() {}, markFinished() {}, notifyStateUpdated() {} };
  dispatcher.init({
    events,
    ensureWorktree: async () => ({ path: '/tmp/wt', detached: false, outOfSync: false }),
    runWorker: async (pr, threads, wtPath, outPath, opts) => {
      runs.push({ prKey: `${pr.repo}#${pr.number}`, threadCount: threads.length, rebase: opts.rebase, applyApproved: opts.applyApproved });
      return { spawned: true, sessionId: 's', code: 0, tail: '' };
    },
    refreshOnePR: async () => {},
    outPath: () => '/tmp/out.json',
    markOutOfSync: () => {},
  });
  return runs;
}

const flush = () => new Promise((r) => setTimeout(r, 20));

test('enqueueRebase with no threads still dispatches a rebase-only worker run', async () => {
  const runs = harness();
  const pr = { repo: 'site-vdp-remix', number: 835, branchHealth: {} };
  dispatcher.enqueueRebase(pr, { branchHealth: pr.branchHealth });
  await flush();
  assert.equal(runs.length, 1);
  assert.equal(runs[0].prKey, 'site-vdp-remix#835');
  assert.equal(runs[0].threadCount, 0);
  assert.equal(runs[0].rebase, true);
});

// A thrown worker run must NOT silently drop its batch (the threads were already marked
// "seen" by the poller, so they can't re-enqueue on their own). The batch is re-staged and
// retried on the next enqueue — without hot-looping in between.
test('a thrown worker run re-stages its batch and retries on the next enqueue', async () => {
  const runs = [];
  let failNext = true;
  dispatcher.init({
    events: { markStarted() {}, markFinished() {}, notifyStateUpdated() {} },
    ensureWorktree: async () => ({ path: '/tmp/wt', outOfSync: false }),
    runWorker: async (pr, threads) => {
      if (failNext) { failNext = false; throw new Error('git push failed'); }
      runs.push({ threadCount: threads.length });
      return { spawned: true, sessionId: 's', code: 0 };
    },
    refreshOnePR: async () => {},
    outPath: () => '/tmp/o.json',
    markOutOfSync: () => {},
    markAgentError: () => {},
  });
  const pr = { repo: 'rstage', number: 1, threads: [{ threadId: 't1' }], branchHealth: {} };
  dispatcher.enqueue(pr, [{ threadId: 't1' }], {});
  await flush();
  assert.equal(runs.length, 0);                       // the run threw — no success yet
  assert.equal(dispatcher.pendingCount('rstage#1'), 1); // but t1 was re-staged, not lost
  // a genuine new enqueue clears the failure gate and retries the MERGED batch
  dispatcher.enqueue(pr, [{ threadId: 't2' }], {});
  await flush();
  assert.equal(runs.length, 1);
  assert.equal(runs[0].threadCount, 2);               // t1 (re-staged) + t2
  dispatcher.forget('rstage#1');
});

// forget() while a worker is RUNNING must not drop the per-PR `running` lock: deleting the
// entry would let a concurrent enqueue mint a fresh one and dispatch a SECOND worker on the
// same session/worktree. It tombstones instead, so no double-dispatch.
test('forget() during a running worker keeps the lock (no double-dispatch)', async () => {
  const runs = [];
  let release;
  const gate = new Promise((r) => { release = r; });
  dispatcher.init({
    events: { markStarted() {}, markFinished() {}, notifyStateUpdated() {} },
    ensureWorktree: async () => ({ path: '/tmp/wt', outOfSync: false }),
    runWorker: async (pr) => { runs.push(`${pr.repo}#${pr.number}`); await gate; return { spawned: true, code: 0 }; },
    refreshOnePR: async () => {},
    outPath: () => '/tmp/o.json',
    markOutOfSync: () => {},
  });
  const pr = { repo: 'tomb', number: 1, threads: [], branchHealth: {} };
  dispatcher.enqueueRebase(pr, {});
  await flush();
  assert.equal(runs.length, 1);
  assert.equal(dispatcher.isWorking('tomb#1'), true);
  dispatcher.forget('tomb#1');                         // forget while running
  assert.equal(dispatcher.isWorking('tomb#1'), true);  // lock retained (tombstoned, not deleted)
  dispatcher.enqueueRebase(pr, {});                    // a racing enqueue
  await flush();
  assert.equal(runs.length, 1);                        // must NOT have started a 2nd worker
  release();
  await flush();
});

// #10/#12: markFinished must report whether a queued batch will run NEXT, so the client can
// keep an optimistic "dispatched" overlay alive instead of snapping a still-applying approval
// back to "Approve" when the PRIOR run finishes. The first finish (work queued mid-run) must
// carry pending:true; the follow-up run's finish (nothing left) must carry pending:false.
test('markFinished carries pending=true while a queued batch remains, false when drained', async () => {
  const finishes = [];
  let firstGate, release;
  firstGate = new Promise((r) => { release = r; });
  let call = 0;
  dispatcher.init({
    events: { markStarted() {}, markFinished(prKey, opts = {}) { finishes.push(!!opts.pending); }, notifyStateUpdated() {} },
    ensureWorktree: async () => ({ path: '/tmp/wt', outOfSync: false }),
    runWorker: async () => { call += 1; if (call === 1) await firstGate; return { spawned: true, code: 0 }; },
    refreshOnePR: async () => {},
    outPath: () => '/tmp/o.json',
    markOutOfSync: () => {},
    markAgentError: () => {},
  });
  const pr = { repo: 'pend', number: 1, threads: [{ threadId: 'a' }, { threadId: 'b' }], branchHealth: {} };
  dispatcher.enqueueApproved(pr, ['a'], {});           // worker A starts (gated)
  await flush();
  assert.equal(dispatcher.isWorking('pend#1'), true);
  dispatcher.enqueueApproved(pr, ['b'], {});           // queue MORE while A runs
  release();                                            // A finishes -> pending:true (b queued)
  await flush(); await flush();                         // A's finally, then B runs+finishes
  assert.deepEqual(finishes, [true, false]);           // A: queued batch pending; B: drained
  dispatcher.forget('pend#1');
});
