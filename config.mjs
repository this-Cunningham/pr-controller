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
  host: env.PRC_HOST || local.host || base.host || 'github.com',           // PRC_HOST
  owner: env.PRC_OWNER || local.owner || base.owner || '',                 // PRC_OWNER
  login: env.PRC_LOGIN || local.login || base.login || '',                 // PRC_LOGIN
  port: Number(env.PRC_PORT) || local.port || 4317,                        // PRC_PORT
  pollMinutes: Number(env.PRC_POLL_MINUTES) || local.pollMinutes || 15,    // PRC_POLL_MINUTES
  reenrichFloor: Number(env.PRC_REENRICH_FLOOR) || local.reenrichFloor || 5,

  // PRs to watch. DEFAULT (normal production): empty = ALL your open, NON-DRAFT PRs. A
  // whitelist (PRC_ONLY_PRS="repo#1,repo#2", or a profile's onlyPRs) restricts to exactly
  // those — that's for testing / a dev sandbox, not normal use.
  onlyPRs: 'PRC_ONLY_PRS' in env ? csv(env.PRC_ONLY_PRS) : (local.onlyPRs || base.onlyPRs),

  cloneRoot: env.PRC_CLONE_ROOT || local.cloneRoot || join(homedir(), 'src'),  // PRC_CLONE_ROOT
  gitProtocol: (env.PRC_GIT_PROTOCOL || local.gitProtocol || 'ssh').toLowerCase() === 'https' ? 'https' : 'ssh',

  // Check categorization: compliance = needs your input; ignore = dropped; else = code CI.
  complianceChecks: ['compliance/sox', 'compliance/'],
  ignoreChecks: ['license/', 'cla', 'dco'],
  jiraPattern: '[A-Z]{2,}-\\d+',
  triggerToken: '@claude-plz-fix',
  debugToken: '@claude-debug',
  workerModel: env.PRC_WORKER_MODEL || local.workerModel || 'sonnet',       // PRC_WORKER_MODEL

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
