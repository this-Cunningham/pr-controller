// Single home for the durable per-PR Claude session store (data/sessions.json). One file is
// shared by ALL PRs and written from concurrent contexts (worker dispatch across PRs + cleanup
// on merge/close), so EVERY read-modify-write goes through the ONE withSessionsLock here — a
// separate lock would not serialize against the others and the cross-PR lost-update race (a
// cleanup or worker write clobbering an unrelated PR's freshly-minted session) would remain.
// worker.mjs builds its session-lifecycle wrappers (getOrCreate/persist/interrupted/seenSha)
// on these primitives; cleanup.mjs prunes a vanished PR via removeSessionEntry.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { SESSIONS } from './paths.mjs';

// Read the whole map (or {} when the file is absent/unreadable — a fresh install, or a torn
// read racing a write: JSON.parse throws and we fall back to {}). Read-only; no lock needed.
export async function loadSessions(path = SESSIONS) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return {}; }
}

// Serialize every read-modify-write of sessions.json. Dispatch is concurrent across PRs, so
// racing load->mutate->write cycles would lost-update — clobbering a freshly-minted UUID/
// lastSeenSha (or an unrelated PR's entry) and stranding a session `--resume` can't find.
const swallow = () => {};
let tail = Promise.resolve();
export function withSessionsLock(fn) {
  const run = tail.then(fn, fn);          // run after the prior holder, resolved or not
  tail = run.then(swallow, swallow);      // a rejection here must not poison the chain
  return run;
}

// Locked read-modify-write. `mutate(map)` edits the loaded map in place; returning false skips
// the write (nothing changed). mkdir guards a fresh clone where data/ (gitignored) may not exist.
export function updateSessions(mutate, path = SESSIONS) {
  return withSessionsLock(async () => {
    const map = await loadSessions(path);
    if (mutate(map) === false) return;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(map, null, 2));
  });
}

// Remove a PR's entry under the shared lock (used by cleanup when a PR merges/closes). No-op
// when the key is absent, so it never writes a no-change file.
export function removeSessionEntry(prKey, path = SESSIONS) {
  return updateSessions((map) => {
    if (!(prKey in map)) return false;
    delete map[prKey];
  }, path);
}
