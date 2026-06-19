// Pure decision logic — no I/O, no side effects. Extracted so behavior can be
// locked with tests (see test/rules.test.mjs). server.mjs and scanner.mjs import
// these instead of inlining, so the tests and the runtime share one source.
import { config } from './config.mjs';

const includesAny = (name, list) =>
  list.some((s) => (name || '').toLowerCase().includes(s.toLowerCase()));

// TEMP (debug): the synthetic login a @claude-debug comment is attributed to, so a
// comment from YOUR OWN account on the sandbox PR behaves like a real REVIEWER's
// (not just an opt-in token). Lets you exercise the full reviewer-last-word flow —
// dispatch + notYetReviewed -> In progress -> disposition — without a 2nd account.
export const DEBUG_REVIEWER = 'claude-debug-reviewer';

// TEMP (debug): rewrite a thread so a comment carrying config.debugToken counts as
// if a different person reviewed the PR. When the latest comment is YOURS and has
// the token, re-attribute lastAuthor (and author, if you also opened the thread) to
// DEBUG_REVIEWER. Pure: returns a new thread (or the same one untouched). Applied in
// the scanner so EVERY downstream consumer (dispatchable, deriveTier, the UI author
// line) sees the simulated reviewer. Remove with the rest of the debug path.
export function applyDebugReviewer(thread, login = config.login, debugToken = config.debugToken) {
  if (!debugToken || !thread || thread.error) return thread;
  if (thread.lastAuthor !== login || !(thread.lastBody || '').includes(debugToken)) return thread;
  return {
    ...thread,
    author: thread.author === login ? DEBUG_REVIEWER : thread.author,
    lastAuthor: DEBUG_REVIEWER,
  };
}

// A changed thread should dispatch a worker UNLESS your own comment is the latest
// one (you're annotating or waiting on the reviewer) — except when you include the
// trigger token, which opts that single thread back in.
// TEMP (debug): config.debugToken (@claude-debug) also opts in, but note threads are
// normally re-attributed to DEBUG_REVIEWER upstream (applyDebugReviewer), so they
// already read as reviewer-authored here; the token check remains as a fallback.
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

// Derive a thread's DISPOSITION from the WORKER's verdict (its code-grounded
// `response`), falling back to who-spoke-last when the worker hasn't judged it.
// This replaces the keyword `preClassify` heuristic — the worker actually reads
// the code, so its verdict is the source of truth. `action` is the matching entry
// from the worker result JSON's `actions[]` (or undefined if none yet).
//
// The disposition vocabulary is shared end-to-end (backend `tier` === frontend
// `tag`); per-item tab routing keys off these names:
//   surface              -> needsYourApproval  (Needs you; reason is code-cited)
//   fix                  -> agentAutoFixed      (Waiting; agent changed code, replied `fixed`)
//   praise               -> agentAcknowledged   (never shown; agent reacted 🎉, no code)
//   no verdict, we last  -> awaitingReviewer    (Waiting; we replied, ball is the reviewer's)
//   no verdict, them last-> notYetReviewed       (In progress; worker hasn't judged yet)
//   thread error         -> agentError          (Needs you)
export function deriveTier(thread, action, login = config.login) {
  if (thread.error) return { tier: 'agentError', reason: thread.error };
  if (action) {
    if (action.response === 'surface')
      return { tier: 'needsYourApproval', reason: action.reason || 'The agent surfaced this for your judgment.' };
    if (action.response === 'praise')
      return { tier: 'agentAcknowledged', reason: action.reason || 'The agent acknowledged this — positive feedback.' };
    // fix (incl. apply-approved): agent changed code and replied — reviewer's move now.
    return { tier: 'agentAutoFixed', reason: action.reason || 'The agent fixed this; waiting on the reviewer.' };
  }
  if (thread.lastAuthor === login)
    return { tier: 'awaitingReviewer', reason: 'You replied last — waiting on the reviewer.' };
  return { tier: 'notYetReviewed', reason: 'No feedback yet — the agent hasn’t reviewed this thread.' };
}

// Merge incoming threads into a pending Map keyed by threadId, in place. Used by
// the dispatcher's pending set so back-to-back enqueues for one PR coalesce into a
// single batch (the same threadId arriving twice doesn't duplicate the work).
// Returns the same Map for convenience. Skips threads without a threadId (e.g.
// scan-error stubs) and any explicitly errored thread.
export function mergePending(pendingMap, incoming) {
  for (const t of incoming || []) {
    if (!t || !t.threadId || t.error) continue;
    pendingMap.set(t.threadId, t);
  }
  return pendingMap;
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
// Still used for the informational "behind base" pill; rebase itself is no longer
// auto-dispatched (it would silently dismiss approvals — see needsRebase).
export function rebaseAllowed(reviewDecision, mergeState, mergeable) {
  if (reviewDecision !== 'APPROVED') return false;
  return mergeState === 'BEHIND' || mergeable === 'CONFLICTING' || mergeState === 'DIRTY';
}

// Does the branch have a genuine merge CONFLICT (not merely behind base)? Not
// gated on approval — a conflict blocks merge regardless. When there's other work
// this run (feedback/CI), the worker rebases as part of it (the branch is changing
// anyway). When there's NOTHING else to do, we do NOT auto-spin a worker just to
// rebase (that would force-push and dismiss reviews on a quiet PR) — instead the
// dashboard shows a manual "Rebase" CTA. See server.poll / decision 'rebase'.
export function needsRebase(mergeState, mergeable) {
  return mergeable === 'CONFLICTING' || mergeState === 'DIRTY';
}

// Decide what (if anything) to dispatch for a PR on a poll, given the diff since
// the last poll. Pure: returns a plan; server.poll() executes it. Extracted from
// poll() so the dispatch rules — including Phase E's idle-conflict auto-rebase —
// are locked by tests instead of buried in I/O.
//   { kind: 'feedback', rebaseOnConflict } -> enqueue(pr, newThreads, {rebaseOnConflict})
//   { kind: 'rebase' }                     -> enqueueRebase(pr)  (idle conflict, Phase E)
//   { kind: 'none' }                       -> do nothing this poll
// Rules:
//  - Dispatch a feedback/CI run only when there's work AND something CHANGED this
//    poll (new threads, or health changed) — a CI failure we already saw doesn't
//    re-spin. A conflict present alongside that work folds in (rebaseOnConflict).
//  - Otherwise, an idle merge conflict (nothing else to do) auto-rebases, but only
//    when health changed — so the same standing conflict isn't re-dispatched every
//    poll (it would force-push in a loop).
export function dispatchDecision({ newThreadCount = 0, ciFailing = false, needsRebase = false, healthChanged = false }) {
  const workToDo = newThreadCount > 0 || ciFailing;
  if (workToDo && (newThreadCount > 0 || healthChanged))
    return { kind: 'feedback', rebaseOnConflict: !!needsRebase };
  if (needsRebase && healthChanged)
    return { kind: 'rebase' };
  return { kind: 'none' };
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
