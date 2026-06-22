import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sum, mean, clamp, gcd } from '../src/math.mjs';

test('sum adds all elements', () => {
  assert.equal(sum([1, 2, 3, 4]), 10);
  assert.equal(sum([]), 0);
});

test('mean averages, 0 for empty', () => {
  assert.equal(mean([2, 4, 6]), 4);
  assert.equal(mean([]), 0);
});

test('clamp constrains to range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(99, 0, 10), 10);
});

test('gcd', () => {
  assert.equal(gcd(12, 8), 4);
  assert.equal(gcd(17, 5), 1);
});
