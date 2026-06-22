import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, truncate, titleCase } from '../src/strings.mjs';

test('slugify', () => {
  assert.equal(slugify('  Hello, World!  '), 'hello-world');
  assert.equal(slugify('Already-Slugged'), 'already-slugged');
});

test('truncate', () => {
  assert.equal(truncate('hello', 10), 'hello');
  assert.equal(truncate('hello world', 5), 'hell…');
});

test('titleCase', () => {
  assert.equal(titleCase('the quick brown fox'), 'The Quick Brown Fox');
});
