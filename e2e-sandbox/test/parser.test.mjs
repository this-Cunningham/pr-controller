import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, tokenize } from '../src/parser.mjs';

test('tokenize splits numbers and operators', () => {
  const kinds = tokenize('1 + 2').map((t) => t.type);
  assert.deepEqual(kinds, ['num', 'op', 'num', 'eof']);
});

test('respects precedence', () => {
  assert.equal(evaluate('1 + 2 * 3'), 7);
  assert.equal(evaluate('(1 + 2) * 3'), 9);
});

test('handles unary minus and division', () => {
  assert.equal(evaluate('-4 / 2'), -2);
  assert.equal(evaluate('10 - 2 - 3'), 5);
});
