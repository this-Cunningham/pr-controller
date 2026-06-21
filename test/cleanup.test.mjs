// Locks the PURE decisions behind per-PR cleanup (cleanup.mjs + worktree.mjs's
// isManagedWorktree). cleanupPr() itself is I/O and not unit-tested here (it removes
// real git worktrees + files); these tests pin the pure logic it composes:
//   - pruneSession: removing exactly one PR's session entry, immutably
//   - parsePrKey:   splitting "repo#number" into repo + numeric number
//   - workerFileFor: the worker verdict filename for a PR
//   - isManagedWorktree: the SAFETY guard that we only ever delete OUR worktree paths
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { config } from '../config.mjs';
import { pruneSession, parsePrKey, workerFileFor } from '../cleanup.mjs';
import { isManagedWorktree } from '../worktree.mjs';

test('pruneSession removes the right key and leaves others', () => {
  const map = {
    'repo-a#1': { id: 'x', createdAt: 't1' },
    'repo-a#2': { id: 'y', createdAt: 't2' },
    'repo-b#7': { id: 'z', createdAt: 't3' },
  };
  const next = pruneSession(map, 'repo-a#1');
  assert.deepEqual(Object.keys(next).sort(), ['repo-a#2', 'repo-b#7']);
  assert.equal(next['repo-a#2'].id, 'y');
  assert.equal(next['repo-b#7'].id, 'z');
});

test('pruneSession is a no-op (but a copy) when the key is missing', () => {
  const map = { 'repo-a#1': { id: 'x' } };
  const next = pruneSession(map, 'repo-z#99');
  assert.deepEqual(next, map);
  // Returns a NEW object, never mutates the input.
  assert.notEqual(next, map);
});

test('pruneSession does not mutate its input', () => {
  const map = { 'repo-a#1': { id: 'x' }, 'repo-a#2': { id: 'y' } };
  pruneSession(map, 'repo-a#1');
  assert.deepEqual(Object.keys(map).sort(), ['repo-a#1', 'repo-a#2']);
});

test('pruneSession tolerates null/garbage maps', () => {
  assert.deepEqual(pruneSession(null, 'a#1'), {});
  assert.deepEqual(pruneSession(undefined, 'a#1'), {});
});

test('parsePrKey splits repo#number with a numeric number', () => {
  assert.deepEqual(parsePrKey('site-vdp-remix#835'), { repo: 'site-vdp-remix', number: 835 });
  assert.deepEqual(parsePrKey('pr-controller#1'), { repo: 'pr-controller', number: 1 });
});

test('parsePrKey rejects malformed keys', () => {
  assert.equal(parsePrKey(''), null);
  assert.equal(parsePrKey('norepo'), null);          // no '#'
  assert.equal(parsePrKey('#5'), null);              // empty repo
  assert.equal(parsePrKey('repo#'), null);           // empty number
  assert.equal(parsePrKey('repo#abc'), null);        // non-numeric number
  assert.equal(parsePrKey(null), null);
  assert.equal(parsePrKey(42), null);
});

test('parsePrKey keeps only the LAST # as the separator (repo names are left intact)', () => {
  // A '#' in a repo name is not expected, but if present the number is the trailing run.
  assert.deepEqual(parsePrKey('weird#name#12'), { repo: 'weird#name', number: 12 });
});

test('workerFileFor matches the daemon outPathFor convention', () => {
  const expected = join(config.baseDir, 'data', 'worker-site-vdp-remix-835.json');
  assert.equal(workerFileFor('site-vdp-remix', 835), expected);
});

test('isManagedWorktree accepts ONLY our ROOT/<repo>-pr-<num> paths', () => {
  const ROOT = join(config.baseDir, 'worktrees');
  assert.equal(isManagedWorktree(join(ROOT, 'site-vdp-remix-pr-835')), true);
  assert.equal(isManagedWorktree(join(ROOT, 'pr-controller-pr-1')), true);
});

test('isManagedWorktree REJECTS user clones and anything outside ROOT (SAFETY)', () => {
  const ROOT = join(config.baseDir, 'worktrees');
  // A reused user clone checkout (the CLEAN-reuse path) lives elsewhere — never delete it.
  assert.equal(isManagedWorktree('/Users/me/cargurus/site-vdp-remix'), false);
  // Right name shape but wrong parent dir -> not ours.
  assert.equal(isManagedWorktree('/tmp/site-vdp-remix-pr-835'), false);
  // Under ROOT but not the per-PR naming -> not ours (e.g. the fallback bare clone).
  assert.equal(isManagedWorktree(join(ROOT, 'site-vdp-remix.git')), false);
  assert.equal(isManagedWorktree(join(ROOT, 'random-dir')), false);
  // A path nested BELOW a managed worktree is not the worktree itself.
  assert.equal(isManagedWorktree(join(ROOT, 'site-vdp-remix-pr-835', 'src')), false);
  assert.equal(isManagedWorktree(''), false);
  assert.equal(isManagedWorktree(null), false);
});
