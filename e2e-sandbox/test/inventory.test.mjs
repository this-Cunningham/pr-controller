import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Inventory } from '../src/inventory.mjs';

test('add accumulates quantity', () => {
  const inv = new Inventory();
  inv.add('apple', 2, 50);
  inv.add('apple', 3, 50);
  assert.equal(inv.count('apple'), 5);
});

test('remove drops line at zero', () => {
  const inv = new Inventory();
  inv.add('pear', 2, 30);
  assert.equal(inv.remove('pear', 1), 1);
  assert.equal(inv.remove('pear', 5), 0);
  assert.equal(inv.count('pear'), 0);
});

test('total sums value', () => {
  const inv = new Inventory();
  inv.add('a', 2, 100); // 200
  inv.add('b', 1, 50); //  50
  assert.deepEqual(inv.total(), { amount: 250, currency: 'USD' });
});
