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

// The three responses the worker may record per thread (worker-prompt §taxonomy).
export const WORKER_RESPONSES = ['fix', 'praise', 'surface'];

// Validate the worker's result JSON against the shape Phase 0 depends on. The
// file is written by the model (free-form), so its shape isn't guaranteed — a
// drifted result (renamed field, fenced JSON, missing actions) would silently
// fall threads through to "pending". This catches that. Returns the sanitized
// result plus a list of human-readable `problems`; `result` is null when the
// payload is unusable. Drops individual malformed actions rather than rejecting
// the whole file, so one bad entry doesn't lose every verdict.
export function validateWorkerResult(raw) {
  const problems = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return { result: null, problems: ['result is not a JSON object'] };
  if (raw.actions !== undefined && !Array.isArray(raw.actions))
    return { result: null, problems: ['`actions` is present but not an array'] };

  const actions = [];
  for (const [i, a] of (raw.actions || []).entries()) {
    if (!a || typeof a !== 'object') { problems.push(`action[${i}] is not an object`); continue; }
    if (!a.threadId) { problems.push(`action[${i}] missing threadId`); continue; }
    if (!WORKER_RESPONSES.includes(a.response)) {
      problems.push(`action[${i}] (${a.threadId}) has invalid response ${JSON.stringify(a.response)}`);
      continue;
    }
    actions.push(a);
  }

  const bh = raw.branchHealth;
  if (bh !== undefined && (typeof bh !== 'object' || Array.isArray(bh)))
    problems.push('`branchHealth` is present but not an object');
  if (bh?.surfaced !== undefined && bh.surfaced !== null && typeof bh.surfaced !== 'string')
    problems.push('`branchHealth.surfaced` is present but not a string');

  return { result: { ...raw, actions }, problems };
}

// Derive a thread's dashboard tier from the WORKER's verdict (its code-grounded
// `response`), falling back to who-spoke-last when the worker hasn't judged it.
// This replaces the keyword `preClassify` heuristic — the worker actually reads
// the code, so its verdict is the source of truth. `action` is the matching entry
// from the worker result JSON's `actions[]` (or undefined if none yet).
//   surface            -> hash-out      (worker wants YOUR call; reason is code-cited)
//   fix | praise        -> waiting-reviewer (worker acted + replied; ball is the reviewer's)
//   no verdict, we last -> waiting-reviewer (we replied; waiting on the reviewer)
//   no verdict, them last -> pending      ("No feedback yet" — worker hasn't run/judged)
export function deriveTier(thread, action, login = config.login) {
  if (thread.error) return { tier: 'error', reason: thread.error };
  if (action) {
    if (action.response === 'surface')
      return { tier: 'hash-out', reason: action.reason || 'The agent surfaced this for your judgment.' };
    // fix/praise: the worker acted and (for fix) replied — it's the reviewer's move now.
    return { tier: 'waiting-reviewer', reason: action.reason || 'The agent handled this; waiting on the reviewer.' };
  }
  if (thread.lastAuthor === login)
    return { tier: 'waiting-reviewer', reason: 'You replied last — waiting on the reviewer.' };
  return { tier: 'pending', reason: 'No feedback yet — the agent hasn’t reviewed this thread.' };
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
