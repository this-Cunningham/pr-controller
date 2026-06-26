// Locks the shutdown drain policy (drainWorkers): on a daemon kill, in-flight workers
// get a bounded grace to finish on their own, then SIGTERM, then SIGKILL — so the
// process never exits leaving an orphan. The I/O (count/kill/sleep) is injected, so no
// real `claude` is spawned and no real timers run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drainWorkers } from '../worker.mjs';

const noopLog = { info() {}, warn() {}, error() {}, debug() {} };
const immediateSleep = async () => {};

test('drainWorkers returns drained=true when workers finish within the grace window', async () => {
  let n = 2, ticks = 0;
  const count = () => { ticks += 1; if (ticks >= 3) n = 0; return n; };  // empties after a few polls
  const kill = () => { throw new Error('kill must not be called when workers finish on their own'); };
  const r = await drainWorkers({ graceMs: 1000, pollMs: 100, count, kill, sleep: immediateSleep, log: noopLog });
  assert.deepEqual(r, { drained: true, terminated: 0, killed: 0 });
});

test('drainWorkers SIGTERMs then SIGKILLs stragglers that never finish', async () => {
  const signals = [];
  const count = () => 1;                                   // always one straggler
  const kill = (sig) => { signals.push(sig); return 1; };
  const r = await drainWorkers({ graceMs: 300, pollMs: 100, killGraceMs: 50, count, kill, sleep: immediateSleep, log: noopLog });
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);      // escalates when SIGTERM is ignored
  assert.deepEqual(r, { drained: false, terminated: 1, killed: 1 });
});

test('drainWorkers does NOT SIGKILL when SIGTERM is enough', async () => {
  let alive = 1;
  const signals = [];
  const count = () => alive;
  const kill = (sig) => { signals.push(sig); if (sig === 'SIGTERM') alive = 0; return 1; };
  const r = await drainWorkers({ graceMs: 100, pollMs: 50, killGraceMs: 10, count, kill, sleep: immediateSleep, log: noopLog });
  assert.deepEqual(signals, ['SIGTERM']);                 // straggler died on SIGTERM — no SIGKILL
  assert.equal(r.killed, 0);
});

test('drainWorkers with grace 0 kills immediately (no wait) when a worker is in flight', async () => {
  const signals = [];
  const count = () => 1;
  const kill = (sig) => { signals.push(sig); return 1; };
  const r = await drainWorkers({ graceMs: 0, killGraceMs: 0, count, kill, sleep: immediateSleep, log: noopLog });
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  assert.equal(r.drained, false);
});
