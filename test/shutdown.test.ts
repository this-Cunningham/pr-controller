// Locks the shutdown signal-coalescing policy (shutdownAction):
//  - The FIRST signal starts the graceful drain.
//  - A DUPLICATE of the same signal within the debounce window is ignored — this is the
//    machine-delivered double-SIGTERM (node isn't the process-group leader, so a stopper
//    that hits both the group and the pid lands two ~1ms apart). Treating it as a
//    force-exit wrongly skipped drainWorkers on every stop (issue #57).
//  - A genuinely-later second signal (a human tired of waiting) still force-exits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shutdownAction } from '../shutdown.ts';

const DEBOUNCE = 1000;

test('first signal starts the graceful drain', () => {
  assert.equal(shutdownAction(false, 0, DEBOUNCE), 'start');
});

test('duplicate signal 1ms after the first is coalesced (ignored), not a force-exit', () => {
  assert.equal(shutdownAction(true, 1, DEBOUNCE), 'ignore-duplicate');
});

test('duplicate at the exact window edge is still coalesced', () => {
  assert.equal(shutdownAction(true, DEBOUNCE, DEBOUNCE), 'ignore-duplicate');
});

test('a second signal past the window forces an immediate exit', () => {
  assert.equal(shutdownAction(true, DEBOUNCE + 1, DEBOUNCE), 'force-exit');
});

test('a much-later second signal (impatient human) forces exit', () => {
  assert.equal(shutdownAction(true, 8000, DEBOUNCE), 'force-exit');
});
