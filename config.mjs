// PR dashboard config. `onlyPRs` is the scope primitive / circuit-breaker.
export const config = {
  host: 'code.cargurus.com',
  owner: 'cargurus-eng',
  login: 'ccunningham',
  port: 4317,
  pollMinutes: 30,

  // Scope allowlist of "repo#number" keys the tool is allowed to touch.
  //  - empty/null  -> ALL of your open PRs (full production; no circuit-breaker).
  //  - a list      -> ONLY those PRs are scanned and worked (everything else is
  //                   invisible to the daemon).
  // This is both the hardening sandbox (scope to one throwaway PR and exercise the
  // real push/comment/resolve/rebase paths) and a permanent prod kill-switch.
  onlyPRs: ['site-vdp-remix#835'],

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

  baseDir: new URL('.', import.meta.url).pathname,
};
export const ghEnv = { ...process.env, GH_HOST: config.host };
