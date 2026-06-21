// Per-PR git worktree management. One worktree per PR, on its head branch,
// kept until merge. The dispatcher calls ensureWorktree() before runWorker();
// the worker itself then re-grounds with git pull (see worker-prompt.md).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { config } from './config.mjs';
import { loadRepoMap, localCloneFor } from './repo-map.mjs';
import { logger } from './log.mjs';

const exec = promisify(execFile);
const log = logger('cleanup');
const ROOT = join(config.baseDir, 'worktrees');
const fallbackClone = (repo) => join(ROOT, `${repo}.git`);   // only if no local clone
const treeDir = (repo, num) => join(ROOT, `${repo}-pr-${num}`); // worktree per PR

const sshUrl = (nameWithOwner) => `git@${config.host}:${nameWithOwner}.git`;

async function git(cwd, args) {
  const { stdout } = await exec('git', args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  return stdout.trim();
}

// Where (if anywhere) is `branch` already checked out? Returns the worktree path
// or null. The main clone counts as a worktree, so this catches both "primary
// clone is on the PR branch" and "you already made a worktree on it".
async function branchCheckedOutAt(repo, branch) {
  let out;
  try { out = await git(repo, ['worktree', 'list', '--porcelain']); } catch { return null; }
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) cur = line.slice(9);
    else if (line === `branch refs/heads/${branch}`) return cur;
  }
  return null;
}

async function isDirty(path) {
  try { return (await git(path, ['status', '--porcelain'])).length > 0; } catch { return true; }
}

// Fetch + fast-forward `dir` to its remote head. Returns null on success (the
// caller builds its own ready result); if the branch diverged and can't
// fast-forward, returns the outOfSync bail result so the dispatcher surfaces it
// instead of launching a worker on an out-of-sync tree.
async function syncFfOnly(dir) {
  await git(dir, ['fetch', 'origin']);
  try { await git(dir, ['pull', '--ff-only']); return null; }
  catch (e) { return { path: dir, ready: false, outOfSync: true, error: String(e).slice(0, 200) }; }
}

// Returns { path, ready, branch, detached?, pushRefspec?, reused?, outOfSync?, plan }.
// Decision tree (clean reuse > detached worktree > fresh worktree), so we never
// stash or disturb in-progress work in your clones.
export async function ensureWorktree(pr) {
  // Ensure ROOT (worktrees/) exists: the fallback-clone path runs `git clone` with
  // cwd=ROOT and worktrees are placed under it, so a fresh checkout with no local clone
  // and no worktrees/ dir would otherwise fail with a confusing `spawn git ENOENT`.
  await mkdir(ROOT, { recursive: true });
  const path = treeDir(pr.repo, pr.number);
  const branch = pr.headRefName;
  const map = await loadRepoMap();
  const local = localCloneFor(map, pr);
  const repo = local || fallbackClone(pr.repo);

  // RESUME: our managed worktree already exists -> ff-only to remote head.
  if (existsSync(path)) {
    const bail = await syncFfOnly(path);
    if (bail) return bail;
    return { path, ready: true, branch, plan: [] };
  }

  // Need a checkout. First: is the branch already checked out somewhere?
  const existingCheckout = await branchCheckedOutAt(repo, branch);
  const dirty = existingCheckout ? await isDirty(existingCheckout) : false;

  if (existingCheckout && !dirty) {
    // CLEAN reuse — work directly in the checkout you already have.
    const bail = await syncFfOnly(existingCheckout);
    if (bail) return bail;
    return { path: existingCheckout, ready: true, branch, reused: true, plan: [] };
  }

  // Either not checked out anywhere, or checked out but DIRTY.
  // Dirty -> --detach worktree at the branch tip (never touches your work);
  // worker pushes HEAD:branch. Not-checked-out -> normal worktree on the branch.
  const useDetach = !!existingCheckout; // dirty checkout exists

  if (!local && !existsSync(repo)) await git(ROOT, ['clone', sshUrl(pr.nameWithOwner), repo]);
  else await git(repo, ['fetch', 'origin']);

  if (useDetach) {
    await git(repo, ['worktree', 'add', '--detach', path, `origin/${branch}`]);
    return { path, ready: true, branch, detached: true, pushRefspec: `HEAD:${branch}`, plan: [] };
  }
  await git(repo, ['worktree', 'add', path, branch]);
  return { path, ready: true, branch, plan: [] };
}

// True iff `p` is exactly one of OUR managed per-PR worktree paths (ROOT/<repo>-pr-<num>).
// The cleanup path MUST only ever delete these — never a reused user clone checkout
// (the "CLEAN reuse" path in ensureWorktree works directly inside the user's own
// existing clone; deleting that would destroy their work). Pure so it's unit-testable.
export function isManagedWorktree(p) {
  if (!p) return false;
  // Must live directly under ROOT and match the `<repo>-pr-<num>` naming we mint.
  const dir = dirname(p);
  if (dir !== ROOT) return false;
  return /-pr-\d+$/.test(basename(p));
}

// Remove the managed per-PR worktree for a merged/closed PR. Only ever touches
// ROOT/<repo>-pr-<num> (guarded by isManagedWorktree). Resolves the owning clone the
// same way ensureWorktree does, runs `git worktree remove --force` from it, then prunes.
// Defensive: swallows/logs every error, never throws out of cleanup.
export async function removeWorktree(pr) {
  try {
    const path = treeDir(pr.repo, pr.number);
    // SAFETY: never delete anything that isn't our own managed worktree path, and
    // skip entirely if it doesn't exist (e.g. the PR was only ever a CLEAN reuse,
    // which lives in the user's clone and must be left untouched).
    if (!isManagedWorktree(path) || !existsSync(path)) return;

    const map = await loadRepoMap();
    const local = localCloneFor(map, pr);
    const repo = local || fallbackClone(pr.repo);
    if (!existsSync(repo)) return;

    try { await git(repo, ['worktree', 'remove', '--force', path]); }
    catch (e) { log.error(`worktree remove ${path} failed`, String(e).slice(0, 200)); }
    try { await git(repo, ['worktree', 'prune']); }
    catch (e) { log.error(`worktree prune ${repo} failed`, String(e).slice(0, 200)); }
  } catch (e) {
    log.error('removeWorktree failed', String(e).slice(0, 200));
  }
}
