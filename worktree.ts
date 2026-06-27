// Per-PR git worktree management. One worktree per PR, on its head branch,
// kept until merge. The dispatcher calls ensureWorktree() before runWorker();
// the worker itself then re-grounds with git pull (see worker-prompt.md).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { config } from './config.ts';
import { loadRepoMap, localCloneFor } from './repo-map.ts';
import { cloneUrl } from './rules.ts';
import { logger } from './log.ts';
import type { Pr } from './types.ts';

const exec = promisify(execFile);
const log = logger('worktree');
const ROOT = join(config.baseDir, 'worktrees');
const fallbackClone = (repo: string) => join(ROOT, `${repo}.git`);   // only if no local clone
const treeDir = (repo: string, num: number) => join(ROOT, `${repo}-pr-${num}`); // worktree per PR

// The worktree-setup contract returned to the dispatcher (dispatcher.ts reads
// path/outOfSync/detached/pushRefspec/recovered). Internal to this module — not a
// cross-module record in types.ts — so it lives here. All fields past `path` are
// optional because the decision-tree branches each emit a different subset.
interface WorktreeResult {
  path: string;
  ready: boolean;
  branch?: string;
  detached?: boolean;
  pushRefspec?: string;
  reused?: boolean;
  outOfSync?: boolean;
  recovered?: boolean;
  error?: string;
  plan?: string[];
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec('git', args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  return stdout.trim();
}

// Where (if anywhere) is `branch` already checked out? Returns the worktree path
// or null. The main clone counts as a worktree, so this catches both "primary
// clone is on the PR branch" and "you already made a worktree on it".
async function branchCheckedOutAt(repo: string, branch: string): Promise<string | null> {
  let out;
  try { out = await git(repo, ['worktree', 'list', '--porcelain']); } catch { return null; }
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) cur = line.slice(9);
    else if (line === `branch refs/heads/${branch}`) return cur;
  }
  return null;
}

async function isDirty(path: string): Promise<boolean> {
  try { return (await git(path, ['status', '--porcelain'])).length > 0; } catch { return true; }
}

// Fetch + fast-forward `dir` to its remote head. Returns null on success (the
// caller builds its own ready result); if the branch diverged and can't
// fast-forward, returns the outOfSync bail result so the dispatcher surfaces it
// instead of launching a worker on an out-of-sync tree.
async function syncFfOnly(dir: string): Promise<WorktreeResult | null> {
  await git(dir, ['fetch', 'origin']);
  try { await git(dir, ['pull', '--ff-only']); return null; }
  catch (e) { return { path: dir, ready: false, outOfSync: true, error: String(e).slice(0, 200) }; }
}

// Per-clone serialization. Many PRs of the SAME repo share ONE clone (worktrees are
// linked off it). When several dispatch at once, their concurrent `git fetch origin`
// / `git worktree add` race on the clone's shared refs — the loser dies with
// `cannot lock ref 'refs/remotes/origin/<b>': ... unable to update local ref` and the
// whole worker run fails (observed live: 7 simultaneous dispatches, all failed). The
// fix is a per-clone async mutex: worktree SETUP runs one-at-a-time per clone, while
// the long `claude -p` run still proceeds concurrently after setup returns.
const cloneLocks = new Map<string, Promise<unknown>>(); // clonePath -> Promise (tail of the serialized chain)
export function withCloneLock<T>(clonePath: string, fn: () => Promise<T>): Promise<T> {
  const prev = cloneLocks.get(clonePath) || Promise.resolve();
  const run = prev.then(fn, fn); // run fn whether prev resolved or rejected
  // Keep the chain alive but never let a rejection poison the stored tail.
  cloneLocks.set(clonePath, run.then(() => {}, () => {}));
  return run;
}

// Reset a MANAGED per-PR worktree back to the remote branch tip after an interrupted
// run (a worker killed mid-action, or the daemon crashed — the daemon flags this via
// wasInterrupted). Aborts any half-done rebase/merge (which would otherwise wedge git),
// then drops local commits + uncommitted edits + untracked files. The remote PR branch
// + the durable Claude session are the source of truth, so discarding the killed run's
// partial work is safe — the resumed worker redoes it cleanly. ONLY ever called on our
// own managed worktree (treeDir), NEVER a reused user clone — see setupWorktree.
export async function recoverWorktree(dir: string, branch: string): Promise<void> {
  await git(dir, ['fetch', 'origin']);
  await git(dir, ['rebase', '--abort']).catch(() => {});   // no-op (nonzero) if no rebase/merge in progress
  await git(dir, ['merge', '--abort']).catch(() => {});
  await git(dir, ['reset', '--hard', `origin/${branch}`]);
  await git(dir, ['clean', '-fd']);
}

// Returns { path, ready, branch, detached?, pushRefspec?, reused?, outOfSync?, recovered?, plan }.
// Decision tree (clean reuse > detached worktree > fresh worktree), so we never
// stash or disturb in-progress work in your clones. opts.recover (set by the dispatcher
// when the last run was interrupted) hard-resets our managed worktree first.
export async function ensureWorktree(pr: Pr, opts: { recover?: boolean } = {}): Promise<WorktreeResult> {
  // Ensure ROOT (worktrees/) exists: the fallback-clone path runs `git clone` with
  // cwd=ROOT and worktrees are placed under it, so a fresh checkout with no local clone
  // and no worktrees/ dir would otherwise fail with a confusing `spawn git ENOENT`.
  await mkdir(ROOT, { recursive: true });
  const path = treeDir(pr.repo, pr.number);
  // `Pr.headRefName` is optional on the shared type (a base PR before enrichment), but a
  // PR only reaches dispatch — the only caller — fully enriched, so the head branch is
  // always present here. Assert it to satisfy the setup contract (string branch).
  const branch = pr.headRefName as string;
  const map = await loadRepoMap();
  const local = localCloneFor(map, pr);
  const repo = local || fallbackClone(pr.repo);

  // Serialize all git work on this shared clone (see withCloneLock above).
  return withCloneLock(repo, () => setupWorktree(pr, { path, branch, repo, local, recover: !!opts.recover }));
}

interface SetupOpts {
  path: string;
  branch: string;
  repo: string;
  local: string | null;
  recover: boolean;
}

async function setupWorktree(pr: Pr, { path, branch, repo, local, recover }: SetupOpts): Promise<WorktreeResult> {
  // RESUME: our managed worktree already exists -> re-ground to remote head.
  if (existsSync(path)) {
    // `path` is always a managed worktree here (treeDir), so recovery is safe to run on
    // it. The last run was flagged interrupted -> snap it back to the remote tip before
    // resuming, discarding any partial work the killed worker left behind.
    if (recover) await recoverWorktree(path, branch);
    // A worktree we made for a branch checked out DIRTY elsewhere is on a detached HEAD
    // (see useDetach below). There `--ff-only` has no upstream and always fails, falsely
    // marking the PR outOfSync on every resume — so ff to origin/<branch> explicitly,
    // keeping the detached push contract. (symbolic-ref HEAD fails iff detached.)
    const onBranch = await git(path, ['symbolic-ref', '-q', 'HEAD']).then(() => true).catch(() => false);
    if (!onBranch) {
      try {
        await git(path, ['fetch', 'origin']);
        await git(path, ['merge', '--ff-only', `origin/${branch}`]);
        return { path, ready: true, branch, detached: true, pushRefspec: `HEAD:${branch}`, recovered: recover, plan: [] };
      } catch (e) {
        return { path, ready: false, outOfSync: true, error: String(e).slice(0, 200) };
      }
    }
    const bail = await syncFfOnly(path);
    if (bail) return bail;
    return { path, ready: true, branch, recovered: recover, plan: [] };
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

  if (!local && !existsSync(repo)) await git(ROOT, ['clone', cloneUrl(pr.nameWithOwner), repo]);
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
export function isManagedWorktree(p: string | null | undefined): boolean {
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
// Only a PR identifier is needed (repo/number to locate the managed worktree,
// nameWithOwner to resolve the cross-org clone) — not a full enriched Pr, so cleanup
// can call this with just those fields after a PR has merged/closed.
export async function removeWorktree(pr: Pick<Pr, 'repo' | 'number' | 'nameWithOwner'>): Promise<void> {
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
