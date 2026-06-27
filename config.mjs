// pr-controller config. Precedence: PRC_* env > config.local.json (gitignored, persistent) >
// the selected profile. NOTE: PR discovery is `gh search prs --author @me` (the gh-authed
// account), NOT config.login/owner — so with the default prod profile (owner/login='',
// onlyPRs=[]) and an authed gh, the daemon scans ALL your open non-draft PRs and dispatches
// real workers that push. `onlyPRs` is the ONLY blast-radius limit (the circuit-breaker);
// empty = full production. There is no dry-run (see README). server.mjs emits a loud startup
// warning when it runs unconfigured (no config.local.json) AND unscoped (empty onlyPRs).
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { DEFAULT_SENSITIVITY, clampSensitivity } from './sensitivity.mjs';

const env = process.env;
const csv = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
const baseDir = new URL('.', import.meta.url).pathname;

// The poll cadence is clamped to [POLL_MIN, POLL_MAX] in EVERY path — at load (here),
// on each Settings save (server.mjs applyConfigEdits uses clampPoll), and in the UI
// stepper (SettingsSetup.jsx mirrors these bounds). So no env / hand-edited config /
// direct POST can set a value outside the window: a huge value (e.g. 1_000_000) can't
// overflow setInterval (>2^31-1 ms → Node floors to 1 ms → busy-loop), and a zero/
// negative can't make the delay ≤0. Non-numeric input falls to the default.
export const POLL_MIN = 5;
export const POLL_MAX = 60;
export const clampPoll = (n) => {
  const m = Math.round(Number(n));
  return Number.isFinite(m) ? Math.max(POLL_MIN, Math.min(POLL_MAX, m)) : 15;
};

// Persistent local config (config.local.json): { profile?, profiles?: {name:{...}}, + flat overrides }.
let local = {};
const localPath = join(baseDir, 'config.local.json');
const hasLocalConfig = existsSync(localPath);   // exported: lets the daemon warn on an unconfigured run
if (hasLocalConfig) {
  try { local = JSON.parse(readFileSync(localPath, 'utf8')); }
  catch (e) { console.error(`[config] config.local.json failed to parse — ignoring it (${e.message})`); }
}

// PRC_PROFILE (or PRC_DEV=1) selects a profile. Built-ins ship neutral; extend in config.local.json.profiles.
const PROFILES = {
  prod: { host: 'github.com', owner: '', login: '', onlyPRs: [] },
  dev:  { host: 'github.com', owner: '', login: '', onlyPRs: [] },
  ...(local.profiles || {}),
};
const requested = (env.PRC_PROFILE || local.profile || (env.PRC_DEV ? 'dev' : 'prod')).toLowerCase();
const profile = PROFILES[requested] ? requested : 'prod';
const base = PROFILES[profile];

// True when cloneRoot fell back to the ~/src default (no env, no local override). The daemon
// warns if that default dir is missing, since a non-existent cloneRoot silently disables reuse
// of your local clones (every watched repo gets re-cloned fresh instead).
const cloneRootDefaulted = !(env.PRC_CLONE_ROOT || local.cloneRoot);

export const config = {
  profile,
  host: env.PRC_HOST || local.host || base.host || 'github.com',
  owner: env.PRC_OWNER || local.owner || base.owner || '',
  login: env.PRC_LOGIN || local.login || base.login || '',
  port: Number(env.PRC_PORT) || local.port || 4317,
  pollMinutes: clampPoll(Number(env.PRC_POLL_MINUTES) || local.pollMinutes || 15),  // clamped [5,60]
  reenrichFloor: Number(env.PRC_REENRICH_FLOOR) || local.reenrichFloor || 5,

  // On shutdown (SIGTERM/SIGINT) the daemon gives in-flight `claude` workers up to this
  // many ms to finish on their own before it SIGTERMs/SIGKILLs them — so a kill never
  // orphans a worker. 0 = kill immediately. See drainWorkers (worker.mjs) + server.mjs.
  shutdownGraceMs: Number(env.PRC_SHUTDOWN_GRACE_MS) || local.shutdownGraceMs || 15000,

  // PRs to watch. DEFAULT (normal production): empty = ALL your open, NON-DRAFT PRs. A
  // whitelist (PRC_ONLY_PRS="repo#1,repo#2", or a profile's onlyPRs) restricts to exactly
  // those — that's for testing / a dev sandbox, not normal use.
  onlyPRs: 'PRC_ONLY_PRS' in env ? csv(env.PRC_ONLY_PRS) : (local.onlyPRs || base.onlyPRs),

  cloneRoot: env.PRC_CLONE_ROOT || local.cloneRoot || join(homedir(), 'src'),
  gitProtocol: (env.PRC_GIT_PROTOCOL || local.gitProtocol || 'ssh').toLowerCase() === 'https' ? 'https' : 'ssh',

  // Check categorization: compliance = needs your input; ignore = dropped; else = code CI.
  complianceChecks: ['compliance/sox', 'compliance/'],
  ignoreChecks: ['license/', 'cla', 'dco'],
  jiraPattern: '[A-Z]{2,}-\\d+',
  triggerToken: '@claude-plz-fix',
  debugToken: '@claude-debug',
  workerModel: env.PRC_WORKER_MODEL || local.workerModel || 'sonnet',

  // Circuit-breaker for the worker-result seam: how many CONSECUTIVE ERRORED runs the dispatcher
  // auto-retries for a PR before parking it as a terminal "Needs you" workerFailed card — instead
  // of re-dispatching a failing worker forever on every routine enqueue (CI/health churn) or
  // errored-rebase re-attempt, burning API spend. Counts feedback, CI, AND errored rebases (a
  // worker-run failure); a deliberately rebaseSurfaced conflict is a CLEAN run and never counts.
  // A clean run or a genuinely new signal (manual Re-run, brand-new reviewer feedback) resets the
  // count. See dispatcher.recordFailure + rules.shouldRetryWorker / dispatchDecision. Falls to the
  // default for 0/blank/non-numeric (the `||` pattern, like reenrichFloor) — set 1 for the most
  // aggressive cap.
  workerMaxRetries: Number(env.PRC_WORKER_MAX_RETRIES) || local.workerMaxRetries || 3,

  // Worker sensitivity dial (0=surface everything … 4=fully autonomous; default 2).
  // Tunes the instruction injected into every worker run (see sensitivity.mjs). Editable
  // live from the dashboard (Settings → Worker sensitivity, POST /config). 0 is a valid
  // (falsy) level, so resolve with ?? not || — and clamp so a bad value can't wedge dispatch.
  workerSensitivity: clampSensitivity(env.PRC_WORKER_SENSITIVITY ?? local.workerSensitivity ?? DEFAULT_SENSITIVITY),

  baseDir,
};
export const ghEnv = { ...process.env, GH_HOST: config.host };
// First-run signals the daemon uses to warn the operator at startup (see server.mjs).
export { hasLocalConfig, cloneRootDefaulted };
