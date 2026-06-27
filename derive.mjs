// Build the canonical per-PR record from a scanned PR + the worker's last verdict.
// This is THE place that turns raw GitHub data + the agent's stored verdict into the
// shape the dashboard renders (per-thread disposition, branch flags, JIRA need).
// Pure: no I/O. The caller supplies the parsed `workerResult` (server reads it from
// data/worker-<repo>-<num>.json) and `outOfSync` (the dispatcher's durable diverged-
// branch flag, which can't live on the GitHub-rebuilt PR object). Extracted from
// server.deriveAndSetPrFields so the exact production derivation is unit-testable and
// reusable (the e2e scan script runs this same code). Mutates and returns `pr`.
import { isBehindBase, needsRebase, needsJira, deriveDisposition, applyDebugReviewer } from './rules.mjs';

export function deriveRecord(pr, { workerResult = null, outOfSync = false, agentError = null } = {}) {
  const h = pr.branchHealth || {};
  pr.behindBase = isBehindBase(h.mergeState, h.mergeable);     // informational pill
  pr.ciFailing = (h.failingChecks || []).length > 0;           // code CI only
  pr.needsRebase = needsRebase(h.mergeState, h.mergeable);     // genuine merge conflict
  pr.readyToMerge = h.mergeState === 'CLEAN';                  // GitHub's green-button state (a PR-level badge, not a lane)
  // Compliance failing + no JIRA key in title => surface an input box for the ticket.
  pr.needsJira = needsJira(pr.title, h.complianceChecks);

  // Derive each thread's disposition from the WORKER's verdict (its code-grounded
  // response), not a keyword heuristic. The worker resolves threads it fixed/praised,
  // so those are already gone from the scan; what's left is surfaced (needs you),
  // waiting on the reviewer, or not yet judged. Match worker actions by threadId.
  const actions = new Map((workerResult?.actions || []).map((a) => [a.threadId, a]));
  pr.threads = (pr.threads || []).map((raw) => {
    // TEMP (debug): re-attribute a @claude-debug comment from your own account to a synthetic
    // reviewer HERE — the canonical-record boundary — NOT in the scanner (which stays raw
    // GitHub data). applyDebugReviewer is a no-op for real reviewer threads and when no debug
    // token is configured. It preserves threadId/lastCommentId, so seen-fingerprints and the
    // action match below are unaffected. Remove with the rest of the debug path.
    const t = applyDebugReviewer(raw);
    const a = actions.get(t.threadId);
    return { ...t, ...deriveDisposition(t, a), suggestedReply: a?.suggestedReply, suggestedApproach: a?.suggestedApproach };
  });

  // A surfaced branch-health reason means the worker TRIED a rebase and bailed — now
  // yours to resolve. Only honor it while the branch ACTUALLY still conflicts; once
  // resolved (needsRebase false), a stale `surfaced` must not keep pinning the PR.
  const surfaced = workerResult?.branchHealth?.surfaced;
  pr.workerSurfaced = surfaced && pr.needsRebase ? surfaced : undefined;

  // The worker already RE-RAN ("bounced") a flaky-looking CI failure once. Like a surfaced
  // rebase, the daemon must not keep re-attempting (dispatchDecision suppresses CI-only runs
  // while this is set). Gated on "CI not yet green" rather than ciFailing: a bounced run goes
  // PENDING before it re-fails, and gating on ciFailing would clear the flag in that window
  // and let it bounce again forever. Clears once CI actually passes (checkState SUCCESS).
  const ciReran = workerResult?.branchHealth?.ciReran;
  pr.ciReran = ciReran && h.checkState !== 'SUCCESS' ? true : undefined;

  // The branch diverged from the remote and the worktree couldn't fast-forward, so
  // the last dispatch bailed without running. Comes from the dispatcher's durable set.
  pr.outOfSync = outOfSync;
  // A failed worker run (e.g. a git transport/clone/push failure) — surfaced from the
  // dispatcher's durable agent-error set so the failure shows on the card instead of
  // vanishing into the daemon log. A short classified reason, or null when the run was fine.
  pr.workerError = agentError || null;
  return pr;
}
