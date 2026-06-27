import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SENSITIVITY_LEVELS, DEFAULT_SENSITIVITY, clampSensitivity, sensitivityPrompt } from '../sensitivity.ts';

test('5 ordered levels, each with the fields the daemon + UI depend on', () => {
  assert.equal(SENSITIVITY_LEVELS.length, 5);
  for (const L of SENSITIVITY_LEVELS) {
    const keys: (keyof typeof L)[] = ['key', 'name', 'short', 'badgeTone', 'tagline', 'handles', 'surfaces', 'prompt'];
    for (const k of keys)
      assert.ok(L[k] != null, `level ${L.key} missing ${k}`);
    assert.ok(['urgent', 'neutral', 'active'].includes(L.badgeTone), `bad tone ${L.badgeTone}`);
    assert.ok(Array.isArray(L.handles) && Array.isArray(L.surfaces));
    assert.ok(typeof L.prompt === 'string' && L.prompt.length > 0);
  }
});

test('default is balanced (index 2)', () => {
  assert.equal(DEFAULT_SENSITIVITY, 2);
  assert.equal(SENSITIVITY_LEVELS[DEFAULT_SENSITIVITY].key, 'balanced');
});

test('clampSensitivity coerces + bounds; garbage falls back to the default (never throws)', () => {
  assert.equal(clampSensitivity(0), 0);          // 0 is a valid level, not "falsy → default"
  assert.equal(clampSensitivity(4), 4);
  assert.equal(clampSensitivity(-3), 0);
  assert.equal(clampSensitivity(99), 4);
  assert.equal(clampSensitivity('3'), 3);
  assert.equal(clampSensitivity(2.4), 2);
  assert.equal(clampSensitivity('nope'), DEFAULT_SENSITIVITY);
  assert.equal(clampSensitivity(null), DEFAULT_SENSITIVITY);
  assert.equal(clampSensitivity(undefined), DEFAULT_SENSITIVITY);
});

test('sensitivityPrompt returns the level text AND restates the rebase floor', () => {
  const p = sensitivityPrompt(4);
  assert.ok(p.includes(SENSITIVITY_LEVELS[4].prompt));
  assert.match(p, /FLOOR/);
  assert.match(p, /rebase/i);
  // out-of-range / garbage clamps to the default level's text rather than crashing dispatch
  assert.ok(sensitivityPrompt('x').includes(SENSITIVITY_LEVELS[DEFAULT_SENSITIVITY].prompt));
  assert.ok(sensitivityPrompt(0).includes(SENSITIVITY_LEVELS[0].prompt));
});
