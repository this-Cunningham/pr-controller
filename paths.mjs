// Single home for the daemon's on-disk locations under data/ (gitignored). Centralized so
// the data dir + per-PR worker file/transcript names have ONE definition instead of being
// re-derived (and free to drift) in server.mjs, worker.mjs, cleanup.mjs, and repo-map.mjs.
import { join } from 'node:path';
import { config } from './config.mjs';

export const DATA = join(config.baseDir, 'data');
export const STATE = join(DATA, 'state.json');
export const DECISIONS = join(DATA, 'decisions.json');
export const SESSIONS = join(DATA, 'sessions.json');
export const REPO_MAP = join(DATA, 'repo-map.json');

// Per-PR artifacts (both leak on merge/close without cleanup): the worker's verdict JSON
// (what the worker writes / the daemon reads back) and its full run transcript.
export const workerFileFor = (repo, number) => join(DATA, `worker-${repo}-${number}.json`);
export const workerLogFor = (repo, number) => join(DATA, `worker-${repo}-${number}.log`);
