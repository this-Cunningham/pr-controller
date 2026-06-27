// Discover local clones under config.cloneRoot and map owner/repo -> clone path.
// Built once on first poll, cached to data/repo-map.json. PR repos that aren't
// found locally fall back to a clone in worktrees/<repo>.git (see worktree.mjs).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync, type Dirent } from 'node:fs';
import { join, dirname } from 'node:path';
import { config } from './config.ts';
import { repoSlug } from './rules.ts';
import { REPO_MAP as CACHE } from './paths.ts';
import type { Pr } from './types.ts';

const exec = promisify(execFile);
const SEARCH_ROOT = config.cloneRoot;   // set via PRC_CLONE_ROOT / config.local.json

/** One discovered local clone, keyed by its owner/repo slug. */
interface CloneEntry {
  slug: string;
  path: string;
  depth: number;
}

/** owner/repo slug -> cached clone location (the shape persisted to data/repo-map.json). */
type RepoMap = Record<string, { path: string; depth: number }>;

// Recursively find git clones up to `maxDepth` below SEARCH_ROOT.
// depth 0 = <cloneRoot>/<repo>, depth 1 = <cloneRoot>/<workspace>/<repo>, etc.
async function findClones(dir: string, depth: number, maxDepth: number, out: CloneEntry[]): Promise<void> {
  let entries: Dirent[] = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (!e.isDirectory() || e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const sub = join(dir, e.name);
    if (existsSync(join(sub, '.git'))) {
      try {
        const { stdout } = await exec('git', ['-C', sub, 'remote', 'get-url', 'origin']);
        const slug = repoSlug(stdout);
        // Map EVERY local clone by its full owner/repo slug, not just config.owner's —
        // a PR from another org must be able to find its local clone (cross-org).
        if (slug) out.push({ slug, path: sub, depth });
      } catch {}
    }
    if (depth < maxDepth) await findClones(sub, depth + 1, maxDepth, out);
  }
}

export async function buildRepoMap(): Promise<RepoMap> {
  const found: CloneEntry[] = [];
  await findClones(SEARCH_ROOT, 0, 2, found);
  // Duplicate slugs: prefer the shallowest (top-level standalone) clone over a
  // nested workspace copy — those are likely yalc-linked/dev clones we shouldn't mutate.
  const map: RepoMap = {};
  for (const f of found.sort((a, b) => a.depth - b.depth)) {
    if (!map[f.slug]) map[f.slug] = { path: f.path, depth: f.depth };
  }
  // mkdir data/ first: it's gitignored, so a fresh clone may not have it yet and this
  // writeFile would otherwise throw ENOENT (buildRepoMap is reachable on any cache miss,
  // including cleanup paths that never go through writeState's mkdir). dirname keeps it single-sourced.
  await mkdir(dirname(CACHE), { recursive: true });
  await writeFile(CACHE, JSON.stringify(map, null, 2));
  return map;
}

export async function loadRepoMap(): Promise<RepoMap> {
  // External-data boundary: the cache file is written by buildRepoMap, so trust its shape.
  try { return JSON.parse(await readFile(CACHE, 'utf8')) as RepoMap; } catch { return await buildRepoMap(); }
}

// For a PR, return the local clone path if we have one, else null (=> clone fallback).
export function localCloneFor(map: RepoMap, pr: Pick<Pr, 'nameWithOwner' | 'repo'>): string | null {
  // Use the PR's OWN owner/repo (cross-org safe), not the global config.owner —
  // otherwise a PR from another org never matches its local clone.
  const slug = pr.nameWithOwner || `${config.owner}/${pr.repo}`;
  return map[slug]?.path || null;
}
