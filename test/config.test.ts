import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampPoll, POLL_MIN, POLL_MAX } from '../config.ts';

// clampPoll guards the poll cadence in every path (load, Settings save, UI stepper) so a
// bad PRC_POLL_MINUTES / hand-edited config / direct POST can't set a value outside the
// [POLL_MIN, POLL_MAX] window — outside it, setInterval can busy-loop (≤0 ms or >2^31-1 ms,
// both floored to 1 ms by Node), the documented run-pr-controller gotcha.
test('bounds are the product window', () => {
  assert.equal(POLL_MIN, 5);
  assert.equal(POLL_MAX, 60);
});

test('clampPoll keeps in-window cadences and rounds to whole minutes', () => {
  assert.equal(clampPoll(5), 5);
  assert.equal(clampPoll(30), 30);
  assert.equal(clampPoll(60), 60);
  assert.equal(clampPoll(12.6), 13);
});

test('clampPoll caps high values at 60 (setInterval overflow guard)', () => {
  assert.equal(clampPoll(61), 60);
  assert.equal(clampPoll(1440), 60);
  assert.equal(clampPoll(1_000_000), 60);   // would overflow setInterval if it reached it
});

test('clampPoll raises low / non-positive values to 5', () => {
  assert.equal(clampPoll(4), 5);
  assert.equal(clampPoll(1), 5);
  assert.equal(clampPoll(0), 5);
  assert.equal(clampPoll(-10), 5);
});

test('clampPoll sends non-numeric input to the default (in-window)', () => {
  for (const bad of [NaN, Infinity, -Infinity, 'abc', undefined])
    assert.equal(clampPoll(bad), 15, `clampPoll(${String(bad)}) should default to 15`);
});

test('clampPoll output is always a usable setInterval delay (5..60, no overflow)', () => {
  for (const n of [-100, 0, 0.4, 1, 4, 5, 60, 61, 1e9, NaN]) {
    const out = clampPoll(n);
    assert.ok(out >= POLL_MIN && out <= POLL_MAX, `out ${out} in range for input ${n}`);
    assert.ok(out * 60 * 1000 < 2 ** 31 - 1, 'delay fits in a 32-bit setInterval');
  }
});
