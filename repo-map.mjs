// Discover local clones under config.cloneRoot and map owner/repo -> clone path.
// Built once on first poll, cached to data/repo-map.json. PR repos that aren't
// found locally fall back to a clone in worktrees/<repo>.git (see worktree.mjs).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.mjs';
import { repoSlug } from './rules.mjs';

const exec = promisify(execFile);
const SEARCH_ROOT = config.cloneRoot;   // set via PRC_CLONE_ROOT / config.local.json
const CACHE = join(config.baseDir, 'data', 'repo-map.json');

// Recursively find git clones up to `maxDepth` below SEARCH_ROOT.
// depth 0 = <cloneRoot>/<repo>, depth 1 = <cloneRoot>/<workspace>/<repo>, etc.
async function findClones(dir, depth, maxDepth, out) {
  let entries = [];
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

export async function buildRepoMap() {
  const found = [];
  await findClones(SEARCH_ROOT, 0, 2, found);
  // Duplicate slugs: prefer the shallowest (top-level standalone) clone over a
  // nested workspace copy — those are likely yalc-linked/dev clones we shouldn't mutate.
  const map = {};
  for (const f of found.sort((a, b) => a.depth - b.depth)) {
    if (!map[f.slug]) map[f.slug] = { path: f.path, depth: f.depth };
  }
  await writeFile(CACHE, JSON.stringify(map, null, 2));
  return map;
}

export async function loadRepoMap() {
  try { return JSON.parse(await readFile(CACHE, 'utf8')); } catch { return await buildRepoMap(); }
}

// For a PR, return the local clone path if we have one, else null (=> clone fallback).
export function localCloneFor(map, pr) {
  // Use the PR's OWN owner/repo (cross-org safe), not the global config.owner —
  // otherwise a PR from another org never matches its local clone.
  const slug = pr.nameWithOwner || `${config.owner}/${pr.repo}`;
  return map[slug]?.path || null;
}
