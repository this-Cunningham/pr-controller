// PR dashboard config. `onlyPRs` is the scope primitive / circuit-breaker.
//
// A named PROFILE supplies the base identity + default scope:
//   - `prod` (default) -> the cargurus enterprise + real prod PRs.
//   - `dev`            -> the disposable sandbox PRs on personal github.com
//                         (this-Cunningham/pr-controller #1-3, all "[e2e] … safe to
//                         close"). Dev mode runs the daemon end-to-end — including
//                         dispatching real workers — with no production blast radius.
// Select it with PRC_PROFILE=dev  (or the shorthand PRC_DEV=1).
//
// Every individual field can still be overridden by its own env var (PRC_*), which
// beats the profile, so you can point at any GitHub without editing this committed
// config:
//   PRC_HOST, PRC_OWNER, PRC_LOGIN, PRC_PORT, PRC_POLL_MINUTES
//   PRC_ONLY_PRS="repo#1,repo#2"  (empty string = ALL your open PRs; unset = the profile's scope)
const env = process.env;
const csv = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

// Base profiles. A profile sets only host/owner/login + the default onlyPRs scope;
// individual PRC_* vars still win over it. Add more sandboxes here as needed.
const PROFILES = {
  prod: {
    host: 'code.cargurus.com', owner: 'cargurus-eng', login: 'ccunningham',
    onlyPRs: ['site-vdp-remix#835', 'cargurus-listings-ui#2129', 'site-vdp-remix#717'],
  },
  dev: {
    host: 'github.com', owner: 'this-Cunningham', login: 'this-Cunningham',
    // Pressure-test sandbox: the throwaway e2e2/* dummy PRs (#8-#28) on
    // this-Cunningham/pr-controller. This is the circuit-breaker — only these are
    // ever scanned/worked. (#1-3 are the older [e2e] demos, intentionally out of scope.)
    onlyPRs: [
      'pr-controller#8', 'pr-controller#9', 'pr-controller#10', 'pr-controller#11',
      'pr-controller#12', 'pr-controller#13', 'pr-controller#14', 'pr-controller#15',
      'pr-controller#16', 'pr-controller#17', 'pr-controller#18', 'pr-controller#19',
      'pr-controller#20', 'pr-controller#21', 'pr-controller#22', 'pr-controller#23',
      'pr-controller#24', 'pr-controller#25', 'pr-controller#26', 'pr-controller#27',
      'pr-controller#28',
    ],
  },
};
const requested = (env.PRC_PROFILE || (env.PRC_DEV ? 'dev' : 'prod')).toLowerCase();
const profile = PROFILES[requested] ? requested : 'prod';   // unknown name -> prod
const base = PROFILES[profile];

export const config = {
  profile,
  host: env.PRC_HOST || base.host,
  owner: env.PRC_OWNER || base.owner,
  login: env.PRC_LOGIN || base.login,
  port: Number(env.PRC_PORT) || 4317,
  pollMinutes: Number(env.PRC_POLL_MINUTES) || 30,

  // The scanner skips re-enriching a PR whose `updatedAt` is unchanged since the
  // last poll (reusing its cached threads/health). But `updatedAt` is lossy — it
  // doesn't always bump on a CI flip or a thread resolve — so every Kth scan we
  // force a full re-enrich of every in-scope PR regardless. K = reenrichFloor.
  reenrichFloor: Number(env.PRC_REENRICH_FLOOR) || 5,

  // Scope allowlist of "repo#number" keys the tool is allowed to touch.
  //  - empty/null  -> ALL of your open PRs (full production; no circuit-breaker).
  //  - a list      -> ONLY those PRs are scanned and worked (everything else is
  //                   invisible to the daemon).
  // This is both the hardening sandbox (scope to one throwaway PR and exercise the
  // real push/comment/resolve/rebase paths) and a permanent prod kill-switch.
  // Defaults to the active profile's scope (see PROFILES above).
  onlyPRs: 'PRC_ONLY_PRS' in env ? csv(env.PRC_ONLY_PRS) : base.onlyPRs,

  // Check categorization (substring, case-insensitive):
  //  - complianceChecks: red because of a missing JIRA ticket etc. — fixable, but
  //    needs YOUR input (the ticket #). Surfaced with an input box, not auto-fixed.
  //  - ignoreChecks: red by policy/bot, nothing for us to do. Excluded entirely.
  //  Anything else that's red = code CI the worker fixes autonomously.
  complianceChecks: ['compliance/sox', 'compliance/'],
  ignoreChecks: ['license/', 'cla', 'dco'],

  // PR title must contain a JIRA key like ABC-123 to satisfy compliance.
  jiraPattern: '[A-Z]{2,}-\\d+',

  // A thread whose latest comment is yours normally does NOT dispatch a worker
  // (you're annotating or waiting on the reviewer). Including this token in your
  // comment overrides that — it opts that one thread in, actioned on the next poll.
  triggerToken: '@claude-plz-fix',

  // TEMP (debug): same effect as triggerToken — lets a comment from YOUR OWN
  // account opt a thread in, so you can seed dispatchable threads on the sandbox
  // PR without a second account. Set to null/'' to disable; remove entirely once
  // real reviewer threads are available.
  debugToken: '@claude-debug',

  // Model the headless workers run as. Fixed at session birth (a --resume keeps the
  // session's original model). `haiku` for fast/cheap testing; switch to `sonnet`
  // for prod. Unset/null -> the `claude` CLI default.
  workerModel: 'sonnet',

  baseDir: new URL('.', import.meta.url).pathname,
};
export const ghEnv = { ...process.env, GH_HOST: config.host };
