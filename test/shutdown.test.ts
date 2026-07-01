// Locks the shutdown signal-handling policy (shutdownAction):
//  - The FIRST signal (either type) starts the graceful drain.
//  - A duplicate SIGTERM is coalesced (ignored) — machines send SIGTERM once then
//    SIGKILL, so a second SIGTERM is the launch topology delivering the same stop
//    twice (node isn't the process-group leader → group+pid double-delivery ~1ms
//    apart), never impatience. Force-exiting on it skipped drainWorkers (issue #57).
//  - A second SIGINT (a human's deliberate second Ctrl-C) still force-exits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shutdownAction } from '../shutdown.ts';

test('first SIGTERM starts the graceful drain', () => {
  assert.equal(shutdownAction(false, 'SIGTERM'), 'start');
});

test('first SIGINT starts the graceful drain', () => {
  assert.equal(shutdownAction(false, 'SIGINT'), 'start');
});

test('duplicate SIGTERM during shutdown is coalesced (ignored), not a force-exit', () => {
  assert.equal(shutdownAction(true, 'SIGTERM'), 'ignore-duplicate');
});

test('a second SIGINT (deliberate double Ctrl-C) forces an immediate exit', () => {
  assert.equal(shutdownAction(true, 'SIGINT'), 'force-exit');
});
