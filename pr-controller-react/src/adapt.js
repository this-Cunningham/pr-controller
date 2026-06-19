// Adapts the pr-controller backend's state.json into the shapes the vendored
// wabi-sabi design-system components consume (PullRequest / Thread, see
// design-system/components/pr/*.d.ts). The pipeline is the source of truth for
// DATA; this file reshapes it for the UI. Keep this the ONLY translation point.
//
// Backend PR shape (state.json):
//   { number, title, repo, nameWithOwner, url, isDraft, reviewDecision,
//     needsYou, needsJira, behindBase, ciFailing, needsRebase, outOfSync, autoFixable, pending,
//     workerSurfaced, branchHealth: { failingChecks[], complianceChecks[] },
//     threads: [{ threadId, path, line, author, body, lastAuthor, tier, reason, suggested*, error }] }
//   tier is the worker's verdict (rules.deriveTier): needsYourApproval |
//   agentAutoFixed | agentAcknowledged | awaitingReviewer | notYetReviewed | agentError
//
// DS shapes (what the components consume):
//   PullRequest { id, repo, number, title, review, jira, pills[], branch?, threads[] }
//   Thread { id, tag, loc, author, body, reasonSummary, reasonFull?, approach?, reply? }
//   tag is the DS SHORT vocabulary: input | fixed | waiting | pending | praise | error

// Backend disposition tier -> DS thread tag.
const TIER_TO_DSTAG = {
  needsYourApproval: 'input',
  agentAutoFixed: 'fixed',
  awaitingReviewer: 'waiting',
  notYetReviewed: 'pending',
  agentAcknowledged: 'praise',
  agentError: 'error',
};

// Disposition tag -> tab, and branch kind -> tab. Mirrors the DS's own TAG_TAB /
// BRANCH_TAB (design-system PRCard.jsx). Kept here too so routing/section
// membership stays pure (React-free) and unit-testable; the DS card re-derives the
// same result internally from the identical tag vocabulary.
//   input/error -> Needs you · pending -> In progress · fixed/waiting -> Waiting · praise -> none
export const TAG_TAB = { input: 'needs', error: 'needs', pending: 'progress', fixed: 'waiting', waiting: 'waiting', praise: null };
//   conflict -> In progress (agent is rebasing) · surfaced/outofsync -> Needs you
export const BRANCH_TAB = { conflict: 'progress', surfaced: 'needs', outofsync: 'needs' };

// Does this PR have at least one item routing to `tab`?
export function prInTab(pr, tab) {
  const hasThread = (pr.threads || []).some((t) => TAG_TAB[t.tag] === tab);
  const hasBranch = pr.branch && BRANCH_TAB[pr.branch.kind] === tab;
  const hasJira = !!pr.jira && tab === 'needs';
  return hasThread || hasBranch || hasJira;
}

// Per-PR branch health, derived once. Returns the DS BranchHealth shape (or null).
// surfaced (agent tried the rebase and bailed) wins over a raw conflict; out-of-sync
// (the agent never ran) is its own state. A plain conflict means the agent is
// auto-rebasing right now (informational, In progress).
function deriveBranch(raw) {
  const surfaced = raw.workerSurfaced || null;
  if (surfaced) return { kind: 'surfaced', details: surfaced };
  if (raw.outOfSync) return { kind: 'outofsync' };
  if (raw.needsRebase) return { kind: 'conflict' };
  return null;
}

// Signal pills the DS renders (behind base, CI failing). The "N auto-fixable" count
// pill is intentionally dropped — those threads now appear as real rows in Waiting.
function derivePills(raw) {
  const pills = [];
  if (raw.behindBase) pills.push({ label: 'behind base', kind: 'behind' });
  const ci = (raw.branchHealth?.failingChecks || []);
  if (ci.length) pills.push({ label: `CI failing: ${ci.map((c) => c.name).join(', ')}`, kind: 'ci' });
  return pills;
}

function adaptThread(t, i, prId, isDispatched) {
  if (t.error) {
    return { id: `err-${i}`, tag: 'error', loc: '', author: '', body: String(t.error), reasonSummary: 'Scan error.' };
  }
  // lastAuthor (who replied last) differs from author (who opened the thread) once
  // the conversation has moved; show it so a replied-to thread doesn't look stale.
  const author = t.lastAuthor && t.lastAuthor !== t.author ? t.lastAuthor : t.author;
  let tag = TIER_TO_DSTAG[t.tier] || 'waiting';
  // App-only live nuance: a surfaced thread the user approved + ran (dispatched)
  // should move Needs-you -> In progress before the worker finishes. Re-tag it as
  // `pending` so the DS routes it to progress; state.json catches up post-run.
  if (tag === 'input' && isDispatched(prId, t.threadId)) tag = 'pending';
  return {
    id: t.threadId,
    tag,
    loc: `${t.path || ''}${t.line != null ? ':' + t.line : ''}`,
    author: author ? `@${author}` : '',
    body: t.body || '',
    reasonSummary: t.reason || '',
    reasonFull: t.reason || '',
    // Worker-drafted aids on a surfaced (input) thread.
    approach: t.suggestedApproach || undefined,
    reply: t.suggestedReply || undefined,
  };
}

export function adaptPR(pr, overlays = {}) {
  const isDispatched = overlays.isDispatched || (() => false);
  const id = `${pr.repo}#${pr.number}`;
  return {
    id,
    repo: pr.repo,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    review: pr.isDraft ? 'DRAFT' : pr.reviewDecision === 'APPROVED' ? 'APPROVED' : 'REVIEW_REQUIRED',
    jira: !!pr.needsJira,
    pills: derivePills(pr),
    branch: deriveBranch(pr),
    threads: (pr.threads || []).map((t, i) => adaptThread(t, i, id, isDispatched)),
  };
}

// Section membership: each tab lists the FULL DS PRs that have ≥1 item routing to
// it (the DS PRCard then renders only that tab's slice). A PR can appear in several
// tabs. `overlays.isWorking(prId)` also pulls an in-flight PR into In progress even
// before a verdict lands (e.g. a rebase-only run with no threads yet).
export function adaptSections(prs, overlays = {}) {
  const isWorking = overlays.isWorking || (() => false);
  const ui = prs.map((p) => adaptPR(p, overlays));
  const inTab = (key) => ui.filter((p) => prInTab(p, key) || (key === 'progress' && isWorking(p.id)));
  return [
    { key: 'needs', title: 'Needs you', needsYou: true, prs: inTab('needs') },
    { key: 'progress', title: 'In progress', needsYou: false, prs: inTab('progress') },
    { key: 'waiting', title: 'Waiting on reviewer', needsYou: false, prs: inTab('waiting') },
  ];
}

// Strip state.json to the raw pieces the hook needs; sections are computed
// reactively in useDashboard (they depend on frontend overlays, not just fetches).
export function adaptState(state) {
  return {
    prs: state?.prs || [],
    // `scope` is config.onlyPRs: empty = all PRs (full production), a list = the
    // daemon is restricted to those PR keys. The worker always acts on what it sees.
    scope: state?.scope || [],
    updatedAt: state?.updatedAt || null,
  };
}
