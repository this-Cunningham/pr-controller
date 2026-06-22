import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withCloneLock } from '../worktree.mjs';

// withCloneLock guards worktree SETUP so concurrent dispatches against ONE shared
// clone don't race `git fetch` / `git worktree add` on the clone's refs (the live
// "cannot lock ref ... unable to update local ref" failure that killed 7 simultaneous
// worker runs). These lock in: same-clone calls serialize; different clones run in
// parallel; a rejected job doesn't wedge the chain.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('withCloneLock serializes calls on the same clone', async () => {
  const order = [];
  let active = 0;
  let maxActive = 0;
  const job = (id) => async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    order.push(`start-${id}`);
    await sleep(15);
    order.push(`end-${id}`);
    active -= 1;
    return id;
  };
  const clone = '/tmp/clone-A';
  const results = await Promise.all([
    withCloneLock(clone, job(1)),
    withCloneLock(clone, job(2)),
    withCloneLock(clone, job(3)),
  ]);
  assert.deepEqual(results, [1, 2, 3], 'each call resolves with its own value, in order');
  assert.equal(maxActive, 1, 'never more than one job runs at a time on one clone');
  assert.deepEqual(order, ['start-1', 'end-1', 'start-2', 'end-2', 'start-3', 'end-3']);
});

test('withCloneLock lets different clones run concurrently', async () => {
  let active = 0;
  let maxActive = 0;
  const job = () => async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await sleep(15);
    active -= 1;
  };
  await Promise.all([
    withCloneLock('/tmp/clone-X', job()),
    withCloneLock('/tmp/clone-Y', job()),
  ]);
  assert.equal(maxActive, 2, 'distinct clones are not serialized against each other');
});

test('a rejected job does not wedge the clone lock', async () => {
  const clone = '/tmp/clone-R';
  await assert.rejects(withCloneLock(clone, async () => { throw new Error('boom'); }), /boom/);
  // The next job on the SAME clone must still run (the race produced rejections, so
  // the chain has to survive them).
  const v = await withCloneLock(clone, async () => 'ok');
  assert.equal(v, 'ok');
});
