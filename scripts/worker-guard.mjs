#!/usr/bin/env node
// PreToolUse guard for the headless PR worker. Wired into every `claude -p` worker run
// via worker.mjs's `--settings` (see runWorker). Workers run with
// `--permission-mode bypassPermissions` (full autonomy on real PRs), which skips the
// allow/deny permission system — so `--disallowedTools` would NOT be honored. A
// PreToolUse hook, by contrast, ALWAYS fires (even under bypassPermissions) and can deny
// a tool call — so it's the one mechanical place to block destructive, irreversible,
// out-of-scope actions. (A worker once closed an emptied PR whose title said "safe to
// close"; this is the hard enforcement of the worker's intended scope.)
//
// The worker's legitimate surface is reply/react/resolve/commit/push/rebase. This guard
// denies the PR-lifecycle + branch-destruction commands that are never part of that:
// closing/merging a PR, deleting/force-deleting a branch, and bare (non-lease)
// force-pushes. The deny reason tells the worker to surface the PR instead. Everything
// else is allowed (exit 0, no output) — a false deny would stall a worker, so the
// patterns are deliberately narrow.
//
// Protocol: read the PreToolUse JSON on stdin; to BLOCK, print a deny decision and
// exit 0; to ALLOW, exit 0 with no output. Any parse/IO error -> allow (fail-open: the
// guard must never wedge a worker; the prompt guardrail is the backstop).

import { readFileSync } from 'node:fs';

// Each rule: a human reason + a test against the full Bash command string. Narrow on
// purpose — they must not catch the worker's allowed gh/git usage (replies via
// `gh api .../replies`, reactions, `resolveReviewThread`, `git commit`, `git push`,
// `git push --force-with-lease`, `git rebase`).
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
