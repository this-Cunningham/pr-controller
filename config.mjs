// pr-controller config. Precedence: PRC_* env > config.local.json (gitignored, persistent) >
// the selected profile. With no login/scope, server.mjs serves the dashboard but won't scan.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const env = process.env;
const csv = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
const baseDir = new URL('.', import.meta.url).pathname;

// Persistent local config: { profile?, profiles?: {name:{...}}, + flat field overrides }.
let local = {};
try { local = JSON.parse(readFileSync(join(baseDir, 'config.local.json'), 'utf8')); } catch {}

// PRC_PROFILE (or PRC_DEV=1) selects a profile. Built-ins ship neutral; extend in config.local.json.profiles.
const PROFILES = {
  prod: { host: 'github.com', owner: '', login: '', onlyPRs: [] },
  dev:  { host: 'github.com', owner: '', login: '', onlyPRs: [] },
  ...(local.profiles || {}),
};
const requested = (env.PRC_PROFILE || local.profile || (env.PRC_DEV ? 'dev' : 'prod')).toLowerCase();
const profile = PROFILES[requested] ? requested : 'prod';
const base = PROFILES[profile];

export const config = {
  profile,
  host: env.PRC_HOST || local.host || base.host || 'github.com',           // PRC_HOST
  owner: env.PRC_OWNER || local.owner || base.owner || '',                 // PRC_OWNER
  login: env.PRC_LOGIN || local.login || base.login || '',                 // PRC_LOGIN
  port: Number(env.PRC_PORT) || local.port || 4317,                        // PRC_PORT
  pollMinutes: Number(env.PRC_POLL_MINUTES) || local.pollMinutes || 30,    // PRC_POLL_MINUTES
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

  baseDir,
};
export const ghEnv = { ...process.env, GH_HOST: config.host };
