// Pure decision logic — no I/O, no side effects. Extracted so behavior can be
// locked with tests (see test/rules.test.mjs). server.mjs and scanner.mjs import
// these instead of inlining, so the tests and the runtime share one source.
import { config } from './config.mjs';

const includesAny = (name, list) =>
  list.some((s) => (name || '').toLowerCase().includes(s.toLowerCase()));

// A changed thread should dispatch a worker UNLESS your own comment is the latest
// one (you're annotating or waiting on the reviewer) — except when you include the
// trigger token, which opts that single thread back in.
// TEMP (debug): config.debugToken (@claude-debug) does the same, so you can seed
// dispatchable threads from your OWN account on the sandbox PR. Remove once real
// reviewer threads are available. See SPEC §Dispatch.
export function dispatchable(thread, login = config.login, token = config.triggerToken) {
  if (thread.lastAuthor !== login) return true;
  const body = thread.lastBody || '';
  return body.includes(token) || (!!config.debugToken && body.includes(config.debugToken));
}

// Split failing checks into: code CI (worker fixes), compliance (needs your input,
// e.g. a JIRA ticket), and ignored (policy/bot — dropped). Returns the first two.
export function categorizeChecks(failing, cfg = config) {
  const kept = (failing || []).filter((c) => !includesAny(c.name, cfg.ignoreChecks));
  const complianceChecks = kept.filter((c) => includesAny(c.name, cfg.complianceChecks));
  const codeChecks = kept.filter((c) => !includesAny(c.name, cfg.complianceChecks));
  return { codeChecks, complianceChecks };
}

// Compliance is failing AND the PR title has no JIRA key => we need the user's ticket.
export function needsJira(title, complianceChecks, pattern = config.jiraPattern) {
  const hasJira = new RegExp(pattern).test(title || '');
  return (complianceChecks || []).length > 0 && !hasJira;
}

// Rebase only once approved — don't churn the branch while still under review.
export function rebaseAllowed(reviewDecision, mergeState, mergeable) {
  if (reviewDecision !== 'APPROVED') return false;
  return mergeState === 'BEHIND' || mergeable === 'CONFLICTING' || mergeState === 'DIRTY';
}

// Scope gate: is this PR in the allowlist? An empty/null `onlyPRs` means no scope
// restriction (all PRs). A non-empty list restricts the daemon to exactly those
// "repo#number" keys — the hardening sandbox and the prod circuit-breaker.
export function inScope(prKey, onlyPRs = config.onlyPRs) {
  if (!onlyPRs || onlyPRs.length === 0) return true;
  return onlyPRs.includes(prKey);
}

// Normalize any git remote URL (https or ssh, with/without .git) to "owner/repo".
export function repoSlug(url) {
  const m = (url || '').trim().match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
  return m ? m[1] : null;
}
