import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withCloneLock, recoverWorktree } from '../worktree.ts';

const exec = promisify(execFile);

// withCloneLock guards worktree SETUP so concurrent dispatches against ONE shared
// clone don't race `git fetch` / `git worktree add` on the clone's refs (the live
// "cannot lock ref ... unable to update local ref" failure that killed 7 simultaneous
// worker runs). These lock in: same-clone calls serialize; different clones run in
// parallel; a rejected job doesn't wedge the chain.

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

test('withCloneLock serializes calls on the same clone', async () => {
  const order: string[] = [];
  let active = 0;
  let maxActive = 0;
  const job = (id: number) => async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    order.push(`start-${id}`);
    await sleep(15);
    order.push(`end-${id}`);
    active -= 1;
    return id;
  };
  const clone = '/tmp/clone-A';
  const results = await Promise.all([
    withCloneLock(clone, job(1)),
    withCloneLock(clone, job(2)),
    withCloneLock(clone, job(3)),
  ]);
  assert.deepEqual(results, [1, 2, 3], 'each call resolves with its own value, in order');
  assert.equal(maxActive, 1, 'never more than one job runs at a time on one clone');
  assert.deepEqual(order, ['start-1', 'end-1', 'start-2', 'end-2', 'start-3', 'end-3']);
});

test('withCloneLock lets different clones run concurrently', async () => {
  let active = 0;
  let maxActive = 0;
  const job = () => async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await sleep(15);
    active -= 1;
  };
  await Promise.all([
    withCloneLock('/tmp/clone-X', job()),
    withCloneLock('/tmp/clone-Y', job()),
  ]);
  assert.equal(maxActive, 2, 'distinct clones are not serialized against each other');
});

test('a rejected job does not wedge the clone lock', async () => {
  const clone = '/tmp/clone-R';
  await assert.rejects(withCloneLock(clone, async () => { throw new Error('boom'); }), /boom/);
  // The next job on the SAME clone must still run (the race produced rejections, so
  // the chain has to survive them).
  const v = await withCloneLock(clone, async () => 'ok');
  assert.equal(v, 'ok');
});

// recoverWorktree resets a managed worktree back to the remote tip after an interrupted
// run — the on-disk half of "a kill is safe". Locks the three states a killed worker can
// leave (uncommitted edits, an unpushed local commit, a wedged in-progress rebase): each
// must end clean and exactly at origin/<branch>. Real git, in a temp dir.
test('recoverWorktree snaps a dirtied/diverged/rebasing worktree back to origin tip', async () => {
  const root = await mkdtemp(join(tmpdir(), 'prc-recover-'));
  const g = (cwd: string, args: string[]) => exec('git', args, { cwd });
  try {
    // bare remote + a "managed worktree" clone, both on `main`
    await g(root, ['init', '-q', '--bare', '-b', 'main', 'remote.git']);
    const remote = join(root, 'remote.git');
    await g(root, ['clone', '-q', remote, 'wt']);
    const wt = join(root, 'wt');
    await g(wt, ['config', 'user.email', 't@t']); await g(wt, ['config', 'user.name', 't']);
    await g(wt, ['checkout', '-q', '-B', 'main']);
    await writeFile(join(wt, 'f.txt'), 'remote-1\n');
    await g(wt, ['add', 'f.txt']); await g(wt, ['commit', '-qm', 'init']); await g(wt, ['push', '-q', 'origin', 'main']);
    const tip = (await g(wt, ['rev-parse', 'HEAD'])).stdout.trim();

    // remote advances (a second clone pushes a conflicting change to the same line)
    await g(root, ['clone', '-q', remote, 'other']);
    const other = join(root, 'other');
    await g(other, ['config', 'user.email', 't@t']); await g(other, ['config', 'user.name', 't']);
    await g(other, ['checkout', '-q', 'main']);
    await writeFile(join(other, 'f.txt'), 'remote-2\n');
    await g(other, ['commit', '-qam', 'remote-2']); await g(other, ['push', '-q', 'origin', 'main']);
    const newTip = (await g(other, ['rev-parse', 'HEAD'])).stdout.trim();
    assert.notEqual(newTip, tip);

    // simulate a killed worker: an unpushed local commit + a stray untracked file, then a
    // rebase onto the moved remote that conflicts and is left in progress (the conflict
    // leaves f.txt with unmerged content — the "dirty" state recovery must also discard).
    await writeFile(join(wt, 'f.txt'), 'local-edit\n');
    await g(wt, ['commit', '-qam', 'local unpushed']);
    await writeFile(join(wt, 'junk.txt'), 'untracked\n');     // stray untracked file (doesn't block rebase)
    await g(wt, ['fetch', '-q', 'origin']);
    await g(wt, ['rebase', 'origin/main']).catch(() => {});   // conflicts -> left mid-rebase
    assert.ok(existsSync(join(wt, '.git', 'rebase-merge')) || existsSync(join(wt, '.git', 'rebase-apply')),
      'precondition: worktree is wedged mid-rebase');

    // recover -> must abort the rebase, drop everything, and land exactly on origin/main
    await recoverWorktree(wt, 'main');

    assert.ok(!existsSync(join(wt, '.git', 'rebase-merge')) && !existsSync(join(wt, '.git', 'rebase-apply')),
      'rebase aborted');
    assert.equal((await g(wt, ['status', '--porcelain'])).stdout.trim(), '', 'working tree is clean');
    assert.ok(!existsSync(join(wt, 'junk.txt')), 'untracked files removed');
    assert.equal((await g(wt, ['rev-parse', 'HEAD'])).stdout.trim(), newTip, 'HEAD is at origin/main tip');
    assert.equal((await g(wt, ['show', 'HEAD:f.txt'])).stdout, 'remote-2\n', 'content matches the remote tip');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
