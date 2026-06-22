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
// the scanner so EVERY downstream consumer (dispatchable, deriveDisposition, the UI author
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

// Validate the worker's result JSON against the shape the derivation depends on. The
// file is written by the model (free-form), so its shape isn't guaranteed — a
// drifted result (renamed field, fenced JSON, missing actions) would silently
// fall threads through to the notYetReviewed disposition. This catches that. Returns the sanitized
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
// The worker reads the actual code, so its `response` is the source of truth for a
// thread's disposition. `action` is the matching entry from the worker result
// JSON's `actions[]` (or undefined if none yet).
//
// Each disposition name below is routed to a lane by placements.mjs
// (LANE_OF_DISPOSITION); the client maps it to a DS tag for styling only. The verdicts:
//   surface              -> needsYourApproval  (Needs you; reason is code-cited)
//   fix                  -> agentAutoFixed      (Waiting; agent changed code, replied `fixed`)
//   praise               -> agentAcknowledged   (never shown; agent reacted 🎉, no code)
//   no verdict, we last  -> awaitingReviewer    (Waiting; we replied, ball is the reviewer's)
//   no verdict, them last-> notYetReviewed       (In progress; worker hasn't judged yet)
//   thread error         -> agentError          (Needs you)
export function deriveDisposition(thread, action, login = config.login) {
  if (thread.error) return { disposition: 'agentError', reason: thread.error };
  if (action) {
    if (action.response === 'surface')
      return { disposition: 'needsYourApproval', reason: action.reason || 'The agent surfaced this for your judgment.' };
    if (action.response === 'praise')
      return { disposition: 'agentAcknowledged', reason: action.reason || 'The agent acknowledged this — positive feedback.' };
    // fix (incl. apply-approved): agent changed code and replied — reviewer's move now.
    return { disposition: 'agentAutoFixed', reason: action.reason || 'The agent fixed this; waiting on the reviewer.' };
  }
  if (thread.lastAuthor === login)
    return { disposition: 'awaitingReviewer', reason: 'You replied last — waiting on the reviewer.' };
  return { disposition: 'notYetReviewed', reason: 'No feedback yet — the agent hasn’t reviewed this thread.' };
}

// Is a persisted worker verdict file stale? True when none of its actions still
// match a live (unresolved) thread AND the branch is clean — at that point the
// file describes only resolved/closed work, so re-reading it would re-assert a fix
// on a thread that's already gone (the "still shows in auto-handling" bug). Pure so
// the invalidation in server.deriveAndSetPrFields is locked by tests. A run with no
// actions is never "stale" (nothing to invalidate).
export function isWorkerResultStale(result, liveThreadIds, { needsRebase = false, outOfSync = false } = {}) {
  if (!result || !Array.isArray(result.actions) || result.actions.length === 0) return false;
  const live = liveThreadIds instanceof Set ? liveThreadIds : new Set(liveThreadIds || []);
  const anyLive = result.actions.some((a) => live.has(a.threadId));
  return !anyLive && !needsRebase && !outOfSync;
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

// Is the branch out of date with its base (behind, or conflicting/dirty)? Drives the
// informational "behind base" pill.
export function isBehindBase(mergeState, mergeable) {
  return mergeState === 'BEHIND' || mergeable === 'CONFLICTING' || mergeState === 'DIRTY';
}

// Does the branch have a genuine merge CONFLICT (not merely behind base)? A conflict
// blocks merge regardless, so it drives a rebase-only worker run (see dispatchDecision
// / server.poll). Until it clears, review threads on the PR are deferred.
export function needsRebase(mergeState, mergeable) {
  return mergeable === 'CONFLICTING' || mergeState === 'DIRTY';
}

// Decide what (if anything) to dispatch for a PR on a poll, given the diff since
// the last poll. Pure: returns a plan; server.poll() executes it. Locked by tests.
//   { kind: 'rebase' }   -> enqueueRebase(pr)        (resolve the conflict, NO threads)
//   { kind: 'feedback' } -> enqueue(pr, newThreads)  (threads/CI only, branch is clean)
//   { kind: 'none' }     -> do nothing this poll
//
// A real merge CONFLICT and reviewer-feedback are handled as SEPARATE runs, never
// bundled. Rationale: a worker told to both rebase AND judge threads, that then bails
// on an unresolvable rebase, would strand the threads un-judged (marked seen but
// never given a verdict — the PR would hang on "Agent working"). So:
//  - CONFLICT WINS. While a real conflict exists, the ONLY thing we dispatch is a
//    rebase-only run — never feedback. If that rebase bails, the worker surfaces it;
//    poll() defers the threads (does not mark them seen) so they wait for the conflict
//    to clear. The rebase is gated on healthChanged so a conflict isn't re-attempted
//    every poll. And once the agent has SURFACED a conflict as too risky to
//    auto-resolve (rebaseSurfaced), the daemon stops auto-retrying entirely and leaves
//    it in Needs you for the user — re-spinning would just bail again (or force-push
//    something risky). Normal flow resumes once the conflict clears (surfaced drops).
//  - NO CONFLICT -> normal feedback path: dispatch threads/CI only when there's work
//    AND something changed this poll (new threads, or health changed). Feedback runs
//    NEVER rebase — the branch is already mergeable.
export function dispatchDecision({ newThreadCount = 0, ciFailing = false, needsRebase = false, healthChanged = false, rebaseSurfaced = false }) {
  if (needsRebase)
    return rebaseSurfaced ? { kind: 'none' } : healthChanged ? { kind: 'rebase' } : { kind: 'none' };
  const workToDo = newThreadCount > 0 || ciFailing;
  if (workToDo && (newThreadCount > 0 || healthChanged))
    return { kind: 'feedback' };
  return { kind: 'none' };
}

// Which thread fingerprints should be marked "seen" after this poll. A thread is
// "seen" once a worker has actually been handed it. Normally that's every live
// thread. But while a real merge CONFLICT blocks the PR, we dispatch a rebase-ONLY
// run (no threads), so marking threads seen now would strand them un-judged (the
// "Agent working" hang). So during a conflict we DEFER: keep the prior seen set
// (minus threads that have since disappeared) so today's still-new threads stay
// "new" and dispatch as a feedback run the first poll AFTER the conflict clears.
// Pure so server.poll()'s deferral is locked by tests. `prevSeen`/`liveFps` are
// arrays/iterables of thread fingerprints; returns a Set.
export function nextSeenThreads(prevSeen, liveFps, needsRebase) {
  const live = new Set(liveFps);
  if (needsRebase) return new Set([...prevSeen].filter((fp) => live.has(fp)));
  return live;
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

// Build a repo's clone URL WITHOUT hardcoding a transport (the worktree fallback used to
// assume ssh `git@host:..`, which can't bootstrap a repo on an SSH-less host). Configurable
// via config.gitProtocol (PRC_GIT_PROTOCOL) + config.host (PRC_HOST):
//   'https' -> https://<host>/<owner/repo>.git   (auth via a git credential helper)
//   else    -> git@<host>:<owner/repo>.git        (ssh; the default, prior behavior)
// Pure so the URL shapes are locked by tests.
export function cloneUrl(nameWithOwner, { host = config.host, protocol = config.gitProtocol } = {}) {
  return protocol === 'https'
    ? `https://${host}/${nameWithOwner}.git`
    : `git@${host}:${nameWithOwner}.git`;
}

// Is the config complete enough to safely SCAN? Returns human-readable problems ([] = good).
// A missing scope is a problem UNLESS you opt into all-PRs (PRC_ALL_PRS=1), so the daemon
// never silently works ALL your PRs. server.mjs gates the poll loop on this. Pure so it's tested.
export function configProblems(cfg = config, { optInAllPrs = process.env.PRC_ALL_PRS === '1' } = {}) {
  const problems = [];
  if (!cfg.login) problems.push('PRC_LOGIN is not set (the account whose PRs to watch)');
  if ((!cfg.onlyPRs || cfg.onlyPRs.length === 0) && !optInAllPrs)
    problems.push('no scope — set PRC_ONLY_PRS="repo#n,..." (or PRC_ALL_PRS=1 to watch ALL your open PRs)');
  return problems;
}
