// Locks the PURE decisions behind per-PR cleanup (cleanup.mjs + worktree.mjs's
// isManagedWorktree). cleanupPr() itself is I/O and not unit-tested here (it removes
// real git worktrees + files); these tests pin the pure logic it composes:
//   - parsePrKey:   splitting "repo#number" into repo + numeric number
//   - workerFileFor (paths.mjs): the worker verdict filename for a PR
//   - isManagedWorktree: the SAFETY guard that we only ever delete OUR worktree paths
// (Session pruning moved to sessions.mjs/removeSessionEntry — see test/sessions.test.mjs.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { config } from '../config.mjs';
import { parsePrKey } from '../cleanup.mjs';
import { workerFileFor } from '../paths.mjs';
import { isManagedWorktree } from '../worktree.mjs';

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
  assert.equal(isManagedWorktree('/Users/me/code/site-vdp-remix'), false);
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
