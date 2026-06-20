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
