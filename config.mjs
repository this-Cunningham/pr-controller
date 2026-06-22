// pr-controller config. Set values via PRC_* env vars (e.g. a sourced `prc.env`); each field
// names its env var. With no login/scope set the daemon serves the dashboard but won't scan
// (server.mjs gates on rules.configProblems), so an empty scope never silently works ALL your PRs.
import { homedir } from 'node:os';
import { join } from 'node:path';

const env = process.env;
const csv = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

// Profiles: PRC_PROFILE (or PRC_DEV=1) selects one as the default host/owner/login/scope;
// individual PRC_* still override it. Ships neutral — fill your own profiles in here (local),
// or via PRC_* / prc.env. The maintainer's live in MY-PRC-CONFIG.md. Add as many as you like.
const PROFILES = {
  prod: { host: 'github.com', owner: '', login: '', onlyPRs: [] },
  dev:  { host: 'github.com', owner: '', login: '', onlyPRs: [] },
};
const requested = (env.PRC_PROFILE || (env.PRC_DEV ? 'dev' : 'prod')).toLowerCase();
const profile = PROFILES[requested] ? requested : 'prod';   // unknown name -> prod
const base = PROFILES[profile];

export const config = {
  profile,   // active profile name (shown in the startup banner)

  // --- WHO + WHERE (profile defaults; PRC_* override) ---
  host: env.PRC_HOST || base.host || 'github.com',   // PRC_HOST — github.com or your enterprise host
  owner: env.PRC_OWNER || base.owner || '',          // PRC_OWNER — your org/user for bare "repo#n" keys
  login: env.PRC_LOGIN || base.login || '',          // PRC_LOGIN — the account whose open PRs to watch

  port: Number(env.PRC_PORT) || 4317,              // PRC_PORT
  pollMinutes: Number(env.PRC_POLL_MINUTES) || 30, // PRC_POLL_MINUTES

  // --- SCOPE (the circuit-breaker — set this) ---
  // PRC_ONLY_PRS="repo#1,repo#2" restricts the daemon to EXACTLY those PRs (everything else
  // is invisible). Empty = ALL your open PRs (real pushes/comments). The daemon REFUSES to
  // scan an empty scope unless you opt in with PRC_ALL_PRS=1.
  onlyPRs: 'PRC_ONLY_PRS' in env ? csv(env.PRC_ONLY_PRS) : base.onlyPRs,

  // --- LOCAL GIT (where your clones live + how to clone one you don't have) ---
  // PRC_CLONE_ROOT — where your existing clones are (searched to depth 2 by repo-map.mjs; a
  // scoped repo not found there is cloned fresh). Default ~/src; point it at your clones dir.
  cloneRoot: env.PRC_CLONE_ROOT || join(homedir(), 'src'),
  // PRC_GIT_PROTOCOL — 'ssh' (git@host:..; needs an SSH key) or 'https' (https://host/..;
  // needs a git credential helper like `gh auth setup-git`; use on SSH-less hosts: CI/containers).
  gitProtocol: (env.PRC_GIT_PROTOCOL || 'ssh').toLowerCase() === 'https' ? 'https' : 'ssh',

  // The scanner skips re-enriching a PR whose updatedAt is unchanged; every Kth scan it
  // re-enriches everything (updatedAt misses CI flips / resolves). PRC_REENRICH_FLOOR.
  reenrichFloor: Number(env.PRC_REENRICH_FLOOR) || 5,

  // --- Check categorization (substring, case-insensitive) ---
  //  - complianceChecks: red for a missing JIRA ticket etc. — needs YOUR input (surfaced).
  //  - ignoreChecks: red by policy/bot — dropped. Anything else red = code CI the worker fixes.
  complianceChecks: ['compliance/sox', 'compliance/'],
  ignoreChecks: ['license/', 'cla', 'dco'],
  // PR title must contain a JIRA key like ABC-123 to satisfy compliance.
  jiraPattern: '[A-Z]{2,}-\\d+',

  // A thread whose latest comment is yours does NOT dispatch unless it carries this token.
  triggerToken: '@claude-plz-fix',
  // TEMP (debug): lets a comment from your OWN account opt a thread in (seed dispatchable
  // threads without a 2nd account). Set null/'' to disable.
  debugToken: '@claude-debug',

  // Model the headless workers run as — PRC_WORKER_MODEL. `sonnet` for prod, `haiku` for
  // cheap testing. Fixed at session birth (a --resume keeps the original model).
  workerModel: env.PRC_WORKER_MODEL || 'sonnet',

  baseDir: new URL('.', import.meta.url).pathname,
};
export const ghEnv = { ...process.env, GH_HOST: config.host };
