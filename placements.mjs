// Server-authoritative tab routing — the ONE source of truth for which lane each
// item of a PR belongs to. Pure, no I/O, locked by test/placements.test.mjs.
//
// The daemon owns routing and emits a flat list of placement rows whose shape
// already matches the lane layout. A PR that needs your input AND is waiting on a
// reviewer simply emits two rows — "one PR across several tabs" becomes DATA, not
// per-render logic. The frontend filters placements by lane and groups by prKey;
// it derives nothing.
//
// A "disposition" is the per-item verdict. For review threads it's the worker's
// verdict (rules.deriveDisposition): needsYourApproval | agentAutoFixed | agentAcknowledged |
// awaitingReviewer | notYetReviewed | agentError. Non-thread subjects (a missing
// JIRA ticket, branch health, a live worker) carry pseudo-dispositions defined here.

// Lane for each disposition. A null lane means the item appears in NO tab
// (agentAcknowledged = praise: the agent reacted, nothing for anyone to do).
export const LANE_OF_DISPOSITION = {
  // per-thread (the backend disposition vocabulary)
  needsYourApproval: 'needs',
  agentError:        'needs',
  notYetReviewed:    'progress',
  agentAutoFixed:    'waiting',
  awaitingReviewer:  'waiting',
  agentAcknowledged: null,
  // pseudo-dispositions for non-thread subjects
  jiraNeeded:        'needs',
  workerFailed:      'needs',   // a worker run errored (e.g. git transport/clone/push) — surface it
  branchOutOfSync:   'needs',   // branch diverged from remote; worker never ran
  branchConflict:    'needs',    // standing merge conflict — YOUR turn to resolve. The
                                 // client overlays 'progress' ONLY while a rebase worker
                                 // is actually in flight (see adapt.applyOverlays); a
                                 // conflict no agent is on must never look like it's rebasing.
  agentWorking:      'progress',// a worker is in flight with no other progress row yet
};

// Ordering weight WITHIN a lane — lower floats to the top (most urgent first).
// Used for both the per-row sortRank and (via prSortRank) per-PR card ordering.
export const DISPOSITION_RANK = {
  needsYourApproval: 0, jiraNeeded: 0,
  branchOutOfSync: 1, agentError: 1, workerFailed: 1,
  branchConflict: 1, agentWorking: 2,
  agentAutoFixed: 3, notYetReviewed: 4, awaitingReviewer: 5,
  agentAcknowledged: 9,
};

// Resolve a disposition to its lane. Unknown dispositions route to 'needs' (a
// visible, actionable row) rather than vanishing — a renamed/added backend
// disposition surfaces as a card you can see, not a silent disappearance. Tests
// assert the table stays total for the known vocabulary.
export function laneOf(disposition) {
  return Object.prototype.hasOwnProperty.call(LANE_OF_DISPOSITION, disposition)
    ? LANE_OF_DISPOSITION[disposition]
    : 'needs';
}

// Compute the flat placement rows for one derived PR record. Each row is one
// (prKey, lane, subject) the UI renders. `pr` is the server's per-PR record after
// deriveAndSetPrFields: { repo, number, threads:[{ threadId, disposition, reason, error }],
// needsJira, workerSurfaced, outOfSync, needsRebase, workerError, liveStatus? }.
export function placementsFor(pr) {
  const prKey = `${pr.repo}#${pr.number}`;
  const rows = [];
  const push = (subjectKind, subjectId, disposition, reason) => {
    const lane = laneOf(disposition);
    if (!lane) return; // praise etc. — appears in no tab
    rows.push({ prKey, lane, subjectKind, subjectId, disposition, reason: reason || '', sortRank: DISPOSITION_RANK[disposition] ?? 9 });
  };

  // Review threads — one row per thread (errored threads escalate to Needs you).
  (pr.threads || []).forEach((t, i) => {
    if (t.error) { push('thread', t.threadId || `thread-${i}`, 'agentError', t.reason || t.error || 'Scan error.'); return; }
    push('thread', t.threadId || `thread-${i}`, t.disposition, t.reason);
  });

  // Missing JIRA ticket — a compliance check needs your input.
  if (pr.needsJira) push('jira', 'jira', 'jiraNeeded', 'A JIRA ticket is required to satisfy the compliance check.');

  // Branch health (at most one row). A merge conflict is ONE state, `branchConflict`,
  // optionally carrying the agent's explanation of why it couldn't rebase
  // (workerSurfaced). outOfSync (the branch diverged and the agent never ran) is a
  // distinct situation with its own copy. Precedence: explained conflict > outOfSync >
  // plain conflict.
  if (pr.workerSurfaced)
    push('branch', 'branch:conflict', 'branchConflict', typeof pr.workerSurfaced === 'string' ? pr.workerSurfaced : 'The agent flagged a conflict it could not safely rebase.');
  else if (pr.outOfSync)
    push('branch', 'branch:outofsync', 'branchOutOfSync', 'The branch diverged from the remote and the agent could not fast-forward — resolve it in a terminal.');
  else if (pr.needsRebase)
    push('branch', 'branch:conflict', 'branchConflict', '');

  // A failed worker run (git transport/clone/push error, etc.) — a Needs-you callout so it
  // isn't a silent no-op buried in the daemon log. subjectKind 'branch' so adapt.js renders it
  // via the generic BranchStatus; carries the classified reason (rules.classifyWorkerError).
  if (pr.workerError)
    push('branch', 'branch:worker-failed', 'workerFailed', typeof pr.workerError === 'string' ? pr.workerError : 'The worker run failed — see the daemon log.');

  // Live worker status (ephemeral, from the SSE in-flight set): a working/rebasing
  // PR with no other progress row still shows in In progress.
  if ((pr.liveStatus === 'working' || pr.liveStatus === 'rebasing') && !rows.some((r) => r.lane === 'progress'))
    push('live', 'live', 'agentWorking', 'The agent is working on this PR now.');

  return rows;
}

// Per-PR ordering weight within a lane = its most urgent placement. A PR with no
// placements sorts last.
export function prSortRank(rows) {
  if (!rows || !rows.length) return 9;
  return Math.min(...rows.map((r) => (typeof r.sortRank === 'number' ? r.sortRank : 9)));
}
