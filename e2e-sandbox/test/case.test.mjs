import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kebabToCamel } from '../src/case.mjs';

test('kebabToCamel', () => {
  assert.equal(kebabToCamel('foo-bar-baz'), 'fooBarBaz');
  assert.equal(kebabToCamel('single'), 'single');
});
