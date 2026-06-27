// Locks the dispatcher's rebase-only path for auto-rebasing idle conflicts: an
// enqueueRebase with NO threads must still fire one worker run with rebase:true.
// Deps are injected, so no real git/worker spawns.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as dispatcher from '../dispatcher.mjs';
import { config } from '../config.mjs';

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

// Failing-CI PR with NO review threads: dispatchDecision returns 'feedback', the server
// enqueues with { ci: true } and empty threads. The drain guard must still fire one run
// (the worker fixes CI from branchHealth) — without the ci flag it was silently dropped.
test('enqueue with no threads but ci:true still dispatches a CI-fix worker run', async () => {
  const runs = harness();
  const pr = { repo: 'inv', number: 11, branchHealth: { checkState: 'FAILING', failingChecks: [{ name: 'e2e-sandbox CI', state: 'FAILURE' }] } };
  dispatcher.enqueue(pr, [], { branchHealth: pr.branchHealth, ci: true });
  await flush();
  assert.equal(runs.length, 1, 'a CI-only feedback enqueue must spawn exactly one worker');
  assert.equal(runs[0].prKey, 'inv#11');
  assert.equal(runs[0].threadCount, 0);
  assert.equal(runs[0].rebase, false);  // a CI run is not a rebase run
});

// Guard still holds: an enqueue with no threads and no ci/rebase reason must NOT fire
// (e.g. the post-run re-drain when nothing new arrived) — otherwise it would hot-loop.
test('enqueue with no threads and no ci/rebase reason does NOT dispatch', async () => {
  const runs = harness();
  const pr = { repo: 'noop', number: 1, branchHealth: {} };
  dispatcher.enqueue(pr, [], { branchHealth: pr.branchHealth });
  await flush();
  assert.equal(runs.length, 0);
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

// A run that SPAWNS but comes back without a clean result (non-zero exit, refusal, token-cutoff,
// no/garbage file) resolves normally — it never throws — so the dispatcher must route it through
// the SAME surface-and-retry path as a thrown run: mark a durable error AND re-stage the batch
// (the poller already marked these threads "seen", so they can't re-enqueue on their own).
test('a spawned-but-failed run surfaces an error and re-stages its batch', async () => {
  const runs = [];
  const errors = [];
  let failNext = true;
  dispatcher.init({
    events: { markStarted() {}, markFinished() {}, notifyStateUpdated() {} },
    ensureWorktree: async () => ({ path: '/tmp/wt', outOfSync: false }),
    runWorker: async (pr, threads) => {
      if (failNext) { failNext = false; return { spawned: true, sessionId: 's', code: 0, outcome: { ok: false, reason: 'The worker declined to act on this run.' } }; }
      runs.push({ threadCount: threads.length });
      return { spawned: true, sessionId: 's', code: 0, outcome: { ok: true, reason: null } };
    },
    refreshOnePR: async () => {},
    outPath: () => '/tmp/o.json',
    markOutOfSync: () => {},
    markAgentError: (prKey, reason) => errors.push([prKey, reason]),
  });
  const pr = { repo: 'softfail', number: 1, threads: [{ threadId: 't1' }], branchHealth: {} };
  dispatcher.enqueue(pr, [{ threadId: 't1' }], {});
  await flush();
  assert.equal(runs.length, 0);                              // the run failed — no success yet
  assert.equal(dispatcher.pendingCount('softfail#1'), 1);    // t1 re-staged, not lost
  assert.deepEqual(errors.at(-1), ['softfail#1', 'The worker declined to act on this run.']); // surfaced
  // a genuine new enqueue clears the failure gate and retries the MERGED batch, which now succeeds
  dispatcher.enqueue(pr, [{ threadId: 't2' }], {});
  await flush();
  assert.equal(runs.length, 1);
  assert.equal(runs[0].threadCount, 2);                      // t1 (re-staged) + t2
  assert.equal(dispatcher.pendingCount('softfail#1'), 0);    // a clean run drains the batch
  dispatcher.forget('softfail#1');
});

// Shared harness for the circuit-breaker tests: runWorker echoes a MUTABLE `ctl.outcome` (so a
// test can flip a PR from failing to clean mid-stream), counts every call, and captures every
// surfaced error reason. Mirrors the soft-fail harness above.
function failHarness() {
  const runs = [];
  const errors = [];
  const ctl = { outcome: { ok: false, reason: 'boom' } };
  dispatcher.init({
    events: { markStarted() {}, markFinished() {}, notifyStateUpdated() {} },
    ensureWorktree: async () => ({ path: '/tmp/wt', outOfSync: false }),
    runWorker: async (pr, threads) => { runs.push(threads.length); return { spawned: true, sessionId: 's', code: 0, outcome: ctl.outcome }; },
    refreshOnePR: async () => {},
    outPath: () => '/tmp/o.json',
    markOutOfSync: () => {},
    markAgentError: (prKey, reason) => errors.push(reason),
  });
  return { runs, errors, ctl };
}

// Phase 2 — bounded retry + circuit-breaker. A run that fails N times IN A ROW must stop
// auto-retrying once failures reach config.workerMaxRetries (no further runWorker calls), and
// the terminal workerFailed surface must persist — instead of re-dispatching a failing worker
// forever every time a ROUTINE enqueue (the same unchanged thread, CI/health churn) arrives.
test('a worker that keeps failing trips the breaker and stops auto-retrying after the cap', async () => {
  const { runs, errors } = failHarness();   // outcome stays { ok:false } the whole time
  const pr = { repo: 'cap', number: 1, threads: [{ threadId: 't1' }], branchHealth: {} };
  // Re-enqueue the SAME unchanged thread well past the cap — each is a routine signal (not fresh
  // feedback), so it would retry while the breaker is open, then stop cold once it trips.
  for (let i = 0; i < config.workerMaxRetries + 3; i += 1) {
    dispatcher.enqueue(pr, [{ threadId: 't1' }], {});
    await flush();
  }
  assert.equal(runs.length, config.workerMaxRetries, 'auto-retry stops exactly at the cap');
  assert.match(errors.at(-1), /kept failing after \d+ attempts/);  // terminal surface persists
  assert.equal(dispatcher.isWorking('cap#1'), false);
  assert.equal(dispatcher.pendingCount('cap#1'), 1);               // the batch stays staged, parked
  dispatcher.forget('cap#1');
});

// The counter is a STREAK of consecutive failures, not a lifetime total: a clean run zeroes it,
// so the next failing streak gets the FULL budget again rather than tripping early.
test('a clean run resets the failure counter (restores the full retry budget)', async () => {
  const { runs, ctl } = failHarness();
  const pr = { repo: 'reset', number: 1, branchHealth: {} };
  const ci = () => dispatcher.enqueue(pr, [], { ci: true });   // routine: no threads -> never "fresh feedback"
  // Two CI-run failures (below the cap).
  ci(); await flush();
  ci(); await flush();
  assert.equal(runs.length, 2);
  // A clean run zeroes the streak.
  ctl.outcome = { ok: true, reason: null };
  ci(); await flush();
  assert.equal(runs.length, 3);
  // Fail routinely again: because the counter reset, the breaker trips only after the FULL cap
  // once more (not after a single failure) — proving the clean run re-armed the budget.
  ctl.outcome = { ok: false, reason: 'boom' };
  for (let i = 0; i < config.workerMaxRetries + 2; i += 1) { ci(); await flush(); }
  assert.equal(runs.length, 3 + config.workerMaxRetries);
  dispatcher.forget('reset#1');
});

// A tripped breaker is not permanent: a genuinely NEW signal lifts it. Brand-new reviewer
// feedback (a thread not already staged) and the user's manual Re-run (opts.reset) each reset
// the counter and retry — that's the explicit recovery path.
test('a genuinely new signal (fresh feedback or manual Re-run) resets a tripped breaker', async () => {
  const { runs } = failHarness();   // every run fails
  const pr = { repo: 'newsig', number: 1, threads: [{ threadId: 't1' }], branchHealth: {} };
  for (let i = 0; i < config.workerMaxRetries + 2; i += 1) { dispatcher.enqueue(pr, [{ threadId: 't1' }], {}); await flush(); }
  assert.equal(runs.length, config.workerMaxRetries, 'tripped: auto-retry stopped');

  // Brand-new reviewer feedback (t2 not already staged) re-arms and retries past the breaker.
  dispatcher.enqueue(pr, [{ threadId: 't2' }], {}); await flush();
  assert.equal(runs.length, config.workerMaxRetries + 1, 'fresh feedback resets + retries');

  // A manual Re-run (opts.reset) also resets — even though it re-sends only already-staged threads.
  dispatcher.enqueue(pr, [{ threadId: 't1' }, { threadId: 't2' }], { reset: true }); await flush();
  assert.equal(runs.length, config.workerMaxRetries + 2, 'manual Re-run resets + retries');
  dispatcher.forget('newsig#1');
});

// Rebase behavior is NOT governed by the feedback retry breaker. A pure rebase-only run (no
// threads) that keeps erroring still surfaces + re-stages (Phase 1, unchanged) but NEVER trips the
// cap — its retry suppression is owned by dispatchDecision (rebaseSurfaced / healthChanged). So a
// repeatedly-failing rebase keeps being retried, well past workerMaxRetries.
test('a repeatedly-failing rebase-only run is exempt from the breaker (no cap)', async () => {
  const runs = [];
  const errors = [];
  dispatcher.init({
    events: { markStarted() {}, markFinished() {}, notifyStateUpdated() {} },
    ensureWorktree: async () => ({ path: '/tmp/wt', outOfSync: false }),
    runWorker: async () => { runs.push('rebase'); throw new Error('git rebase failed: could not apply'); },
    refreshOnePR: async () => {},
    outPath: () => '/tmp/o.json',
    markOutOfSync: () => {},
    markAgentError: (prKey, reason) => errors.push(reason),
  });
  const pr = { repo: 'reb', number: 1, threads: [], branchHealth: {} };
  // Drive far more rebase attempts than the cap — each throws, each retries (rebase is exempt).
  for (let i = 0; i < config.workerMaxRetries + 3; i += 1) {
    dispatcher.enqueueRebase(pr, {});
    await flush();
  }
  assert.equal(runs.length, config.workerMaxRetries + 3, 'every rebase attempt ran — the breaker never capped it');
  assert.ok(!errors.some((e) => /kept failing after/.test(e || '')), 'no breaker-trip surface for a rebase');
  dispatcher.forget('reb#1');
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

// A PR whose last run was interrupted (durable flag set) must drive worktree recovery:
// ensureWorktree is told to recover, and the worker is told its run is a recovered resume.
test('an interrupted prior run triggers worktree recovery + a recovered resume', async () => {
  const seen = {};
  dispatcher.init({
    events: { markStarted() {}, markFinished() {}, notifyStateUpdated() {} },
    ensureWorktree: async (pr, o = {}) => { seen.recover = o.recover; return { path: '/tmp/wt', outOfSync: false, recovered: !!o.recover }; },
    runWorker: async (pr, threads, path, outPath, o) => { seen.recovered = o.recovered; return { spawned: true, code: 0 }; },
    refreshOnePR: async () => {},
    outPath: () => '/tmp/o.json',
    markOutOfSync: () => {},
    markAgentError: () => {},
    isInterrupted: async () => true,
  });
  const pr = { repo: 'rec', number: 1, threads: [], branchHealth: {} };
  dispatcher.enqueueRebase(pr, {});
  await flush();
  assert.equal(seen.recover, true, 'ensureWorktree told to recover the worktree');
  assert.equal(seen.recovered, true, 'runWorker told the run is a recovered resume');
  dispatcher.forget('rec#1');
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
