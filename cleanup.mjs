// Cleanup of per-PR leftovers when a PR merges/closes and drops out of scan.
// One PR leaves behind three artifacts: its managed git worktree (worktree.mjs),
// its persisted worker verdict file (data/worker-<repo>-<num>.json), and its
// durable Claude session entry (data/sessions.json). When the PR disappears from
// listOpenPRs/scanAll nothing reclaims these — they leak forever. cleanupPr() is
// the single home that reclaims all three. All I/O is defensive: a cleanup failure
// must never break a poll or a refresh.
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.mjs';
import * as worktree from './worktree.mjs';
import { logger } from './log.mjs';

const log = logger('cleanup');
const DATA = join(config.baseDir, 'data');
// Intentionally mirrors worker.mjs's SESSIONS path (join(config.baseDir,'data','sessions.json'))
// rather than importing it, to keep this cleanup module decoupled from worker.mjs.
const SESSIONS = join(DATA, 'sessions.json');

// Parse a prKey ("repo#number") into { repo, number }. Pure + exported so the
// repo/number split that drives worktree + worker-file paths is unit-testable.
// Returns null if the key isn't the expected "repo#number" shape.
export function parsePrKey(prKey) {
  if (typeof prKey !== 'string') return null;
  const hash = prKey.lastIndexOf('#');
  if (hash <= 0 || hash === prKey.length - 1) return null;
  const repo = prKey.slice(0, hash);
  const num = prKey.slice(hash + 1);
  if (!/^\d+$/.test(num)) return null;
  return { repo, number: Number(num) };
}

// The per-PR artifact paths under data/: the worker verdict JSON (mirrors
// server.mjs's outPathFor) and the persisted run transcript (mirrors worker.mjs's
// logPath). Both leak on merge/close without cleanup.
export function workerFileFor(repo, number) {
  return join(DATA, `worker-${repo}-${number}.json`);
}
export function workerLogFor(repo, number) {
  return join(DATA, `worker-${repo}-${number}.log`);
}

// Pure: return a NEW sessions map without `prKey`. The file I/O in cleanupPr wraps
// this; keeping it pure makes the prune logic unit-testable in isolation.
export function pruneSession(sessionsMap, prKey) {
  if (!sessionsMap || typeof sessionsMap !== 'object') return {};
  if (!(prKey in sessionsMap)) return { ...sessionsMap };
  const next = { ...sessionsMap };
  delete next[prKey];
  return next;
}

// Reclaim everything a merged/closed PR left behind: (a) its managed worktree,
// (b) its persisted worker verdict file, (c) its sessions.json entry. Defensive
// throughout — never throws; a failure is logged and the remaining steps still run.
//
// `nameWithOwner` is the PR's true "owner/repo" (PRs can be cross-org). Pass it so
// removeWorktree resolves the SAME clone ensureWorktree used; without it we'd
// reconstruct `${config.owner}/${repo}`, miss a cross-org clone, and leak that PR's
// worktree. Falls back to config.owner only when the caller can't supply it.
export async function cleanupPr(prKey, nameWithOwner = null) {
  const parsed = parsePrKey(prKey);
  if (!parsed) { log.error(`bad prKey: ${prKey}`); return; }
  const { repo, number } = parsed;

  // (a) Remove the managed git worktree (removeWorktree is itself defensive and
  // only ever deletes our own ROOT/<repo>-pr-<num> path).
  await worktree.removeWorktree({ repo, number, nameWithOwner: nameWithOwner || `${config.owner}/${repo}` });

  // (b) Delete the persisted worker verdict file + run transcript if present.
  for (const f of [workerFileFor(repo, number), workerLogFor(repo, number)]) {
    try {
      if (existsSync(f)) await unlink(f);
    } catch (e) {
      log.error(`unlink ${f} for ${prKey} failed`, String(e).slice(0, 200));
    }
  }

  // (c) Prune the prKey entry from sessions.json (read-modify-write via the pure helper).
  try {
    let map = {};
    try { map = JSON.parse(await readFile(SESSIONS, 'utf8')); } catch { map = null; }
    if (map && prKey in map) {
      await writeFile(SESSIONS, JSON.stringify(pruneSession(map, prKey), null, 2));
    }
  } catch (e) {
    log.error(`prune session for ${prKey} failed`, String(e).slice(0, 200));
  }
}
