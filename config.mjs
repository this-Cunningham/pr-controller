// PR dashboard config. SAFE_MODE is the master kill-switch for all mutations.
export const config = {
  host: 'code.cargurus.com',
  owner: 'cargurus-eng',
  login: 'ccunningham',
  port: 4317,
  pollMinutes: 30,

  // SAFE_MODE=true  -> workers may scan/classify/fix/commit IN A WORKTREE,
  //                    but NEVER push, NEVER post comments, NEVER resolve threads,
  //                    and the auto-worker is NOT spawned (classification only).
  // Flip to false only once the UX + classification are trusted.
  SAFE_MODE: true,

  // Check categorization (substring, case-insensitive):
  //  - complianceChecks: red because of a missing JIRA ticket etc. — fixable, but
  //    needs YOUR input (the ticket #). Surfaced with an input box, not auto-fixed.
  //  - ignoreChecks: red by policy/bot, nothing for us to do. Excluded entirely.
  //  Anything else that's red = code CI the worker fixes autonomously.
  complianceChecks: ['compliance/sox', 'compliance/'],
  ignoreChecks: ['license/', 'cla', 'dco'],

  // PR title must contain a JIRA key like ABC-123 to satisfy compliance.
  jiraPattern: '[A-Z]{2,}-\\d+',

  baseDir: new URL('.', import.meta.url).pathname,
};
export const ghEnv = { ...process.env, GH_HOST: config.host };
