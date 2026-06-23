#!/usr/bin/env node
// PreToolUse guard for the headless PR worker, wired into every `claude -p` run via
// worker.mjs's `--settings` (see runWorker). Workers run with bypassPermissions, which
// skips the allow/deny system so `--disallowedTools` is NOT honored — a PreToolUse hook
// ALWAYS fires even under bypassPermissions, so it's the one mechanical place to block
// destructive, out-of-scope actions (closing/merging PRs, branch deletion, bare
// force-push). The worker's legitimate surface is reply/react/resolve/commit/push/rebase.
//
// Protocol: read PreToolUse JSON on stdin; BLOCK = print a deny decision + exit 0,
// ALLOW = exit 0 with no output. Any parse/IO error -> allow (fail-open: the guard must
// never wedge a worker; the prompt guardrail is the backstop).

import { readFileSync } from 'node:fs';

// Each rule: a deny reason + a test against the full Bash command string. Deliberately
// narrow — a false deny stalls a worker, and these must not catch its allowed gh/git
// usage (`gh api .../replies`, reactions, `resolveReviewThread`, `git commit`,
// `git push`, `git push --force-with-lease`, `git rebase`).
const DENY_RULES = [
  { why: 'closing/merging/locking a PR is irreversible and outside the worker\'s mandate — surface it instead',
    test: (c) => /\bgh\s+pr\s+(close|merge|ready|delete|lock)\b/i.test(c) },
  { why: 'mutating PR/issue state via the API (close/merge) is outside the worker\'s mandate',
    test: (c) => /\bgh\s+api\b[\s\S]*\b(state=closed|"?state"?\s*[:=]\s*"?closed|merge(d)?=true)\b/i.test(c) },
  { why: 'a DELETE/PATCH on a pull/issue (close, branch-delete) is outside the worker\'s mandate',
    test: (c) => /\bgh\s+api\b[\s\S]*(-X|--method)\s+(DELETE|PATCH)\b[\s\S]*\b(pulls?|issues?)\b/i.test(c) },
  { why: 'deleting a branch is irreversible and outside the worker\'s mandate',
    test: (c) => /\bgit\s+push\b[\s\S]*(--delete\b|--mirror\b|\s:[^\s]+)/i.test(c)
               || /\bgit\s+branch\s+(-D\b|-d\b|--delete\b)/i.test(c) },
  { why: 'a bare force-push is forbidden — only `--force-with-lease` after a clean rebase is allowed',
    test: (c) => /\bgit\s+push\b/i.test(c)
               && /(--force\b|(^|\s)-f(\s|$))/i.test(c)
               && !/--force-with-lease/i.test(c) },
];

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (input.tool_name !== 'Bash') process.exit(0);        // only Bash can shell out to gh/git
  const cmd = String(input.tool_input?.command || '');
  for (const r of DENY_RULES) {
    if (r.test(cmd)) deny(`Blocked by pr-controller worker guard: ${r.why}.`);
  }
} catch {
  // Fail-open: never let a guard error wedge a worker.
}
process.exit(0);
