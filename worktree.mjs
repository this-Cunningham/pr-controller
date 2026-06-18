// Per-PR git worktree management. One worktree per PR, on its head branch,
// kept until merge. The dispatcher calls ensureWorktree() before runWorker();
// the worker itself then re-grounds with git pull (see worker-prompt.md).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.mjs';
import { loadRepoMap, localCloneFor } from './repo-map.mjs';

const exec = promisify(execFile);
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

// Returns { path, ready, branch, detached?, pushRefspec?, reused?, outOfSync?, plan }.
// Decision tree (clean reuse > detached worktree > fresh worktree), so we never
// stash or disturb in-progress work in your clones.
export async function ensureWorktree(pr) {
  const path = treeDir(pr.repo, pr.number);
  const branch = pr.headRefName;
  const map = await loadRepoMap();
  const local = localCloneFor(map, pr);
  const repo = local || fallbackClone(pr.repo);

  // RESUME: our managed worktree already exists -> ff-only to remote head.
  if (existsSync(path)) {
    if (config.SAFE_MODE) return { path, ready: false, branch, plan: [`cd ${path}`, `git fetch origin`, `git pull --ff-only`] };
    await git(path, ['fetch', 'origin']);
    try { await git(path, ['pull', '--ff-only']); }
    catch (e) { return { path, ready: false, outOfSync: true, error: String(e).slice(0, 200) }; }
    return { path, ready: true, branch, plan: [] };
  }

  // Need a checkout. First: is the branch already checked out somewhere?
  const existingCheckout = (!config.SAFE_MODE || local) ? await branchCheckedOutAt(repo, branch) : null;
  const dirty = existingCheckout ? await isDirty(existingCheckout) : false;

  if (existingCheckout && !dirty) {
    // CLEAN reuse — work directly in the checkout you already have.
    if (config.SAFE_MODE) return { path: existingCheckout, ready: false, branch, reused: true, plan: [`# reuse clean checkout at ${existingCheckout}`, `git -C ${existingCheckout} pull --ff-only`] };
    await git(existingCheckout, ['fetch', 'origin']);
    try { await git(existingCheckout, ['pull', '--ff-only']); }
    catch (e) { return { path: existingCheckout, ready: false, outOfSync: true, error: String(e).slice(0, 200) }; }
    return { path: existingCheckout, ready: true, branch, reused: true, plan: [] };
  }

  // Either not checked out anywhere, or checked out but DIRTY.
  // Dirty -> --detach worktree at the branch tip (never touches your work);
  // worker pushes HEAD:branch. Not-checked-out -> normal worktree on the branch.
  const useDetach = !!existingCheckout; // dirty checkout exists
  if (config.SAFE_MODE) {
    const setup = local ? [`# reuse clone: ${local}`, `git -C ${repo} fetch origin`] : [`git clone ${sshUrl(pr.nameWithOwner)} ${repo}`];
    return {
      path, ready: false, branch, detached: useDetach, usingLocalClone: !!local,
      pushRefspec: useDetach ? `HEAD:${branch}` : null,
      plan: [...setup, useDetach
        ? `git -C ${repo} worktree add --detach ${path} origin/${branch}   # branch dirty elsewhere`
        : `git -C ${repo} worktree add ${path} ${branch}`],
    };
  }

  if (!local && !existsSync(repo)) await git(ROOT, ['clone', sshUrl(pr.nameWithOwner), repo]);
  else await git(repo, ['fetch', 'origin']);

  if (useDetach) {
    await git(repo, ['worktree', 'add', '--detach', path, `origin/${branch}`]);
    return { path, ready: true, branch, detached: true, pushRefspec: `HEAD:${branch}`, plan: [] };
  }
  await git(repo, ['worktree', 'add', path, branch]);
  return { path, ready: true, branch, plan: [] };
}
