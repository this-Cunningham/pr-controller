// Adapts the pr-controller backend's state.json into the shape the design
// components expect. The pipeline is the source of truth for DATA; this file
// reshapes it for the UI (per project decision: optimize the React side, not
// the pipeline). Keep this the ONLY translation point.
//
// Backend PR shape (state.json):
//   { number, title, repo, nameWithOwner, url, isDraft, reviewDecision,
//     needsYou, needsJira, behindBase, ciFailing, autoFixable, pending,
//     workerSurfaced, branchHealth: { failingChecks[], complianceChecks[] },
//     threads: [{ threadId, path, line, author, body, lastAuthor, tier, reason, error }] }
//   tier is derived from the worker's verdict (rules.deriveTier): hash-out |
//   agree-fix | waiting-reviewer | pending | error
//
// UI PR shape (what components consume):
//   { id, repo, number, title, review, jira, pills[], surfaced, threads[] }
//   thread: { id, tag, loc, author, body, reason }

const TIER_TO_TAG = {
  'hash-out': 'hashout',
  'agree-fix': 'agree',
  'waiting-reviewer': 'waiting',
  pending: 'pending',
  praise: 'praise',
  error: 'error',
};

function adaptThread(t, i) {
  if (t.error) {
    return { id: `err-${i}`, tag: 'error', loc: '', author: '', body: String(t.error), reason: 'Scan error.' };
  }
  // lastAuthor (who replied last) differs from author (who opened the thread)
  // once the conversation has moved; show it so a replied-to thread doesn't look stale.
  const author = t.lastAuthor && t.lastAuthor !== t.author ? t.lastAuthor : t.author;
  return {
    id: t.threadId,
    tag: TIER_TO_TAG[t.tier] || 'waiting',
    loc: `${t.path || ''}${t.line != null ? ':' + t.line : ''}`,
    author: author ? `@${author}` : '',
    body: t.body || '',
    reason: t.reason || '',
    // Worker-drafted helpers on surfaced threads (Phase 1 / Phase 2).
    suggestedReply: t.suggestedReply || '',
    suggestedApproach: t.suggestedApproach || '',
  };
}

function adaptPills(pr) {
  const pills = [];
  if (pr.autoFixable) pills.push({ label: `${pr.autoFixable} auto-fixable`, kind: 'auto' });
  if (pr.behindBase) pills.push({ label: 'behind base', kind: 'behind' });
  const ci = pr.branchHealth?.failingChecks || [];
  if (ci.length) pills.push({ label: `CI failing: ${ci.map((c) => c.name).join(', ')}`, kind: 'ci' });
  return pills;
}

// The worker writes a surfaced reason when it hit branch-health it couldn't
// (or wasn't allowed to) fix and punted to the user. Render it as a banner.
function adaptSurfaced(pr) {
  return pr.workerSurfaced || null;
}

export function adaptPR(pr) {
  return {
    id: `${pr.repo}#${pr.number}`,
    repo: pr.repo,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    review: pr.isDraft ? 'DRAFT' : pr.reviewDecision === 'APPROVED' ? 'APPROVED' : 'REVIEW_REQUIRED',
    jira: !!pr.needsJira,
    pills: adaptPills(pr),
    surfaced: adaptSurfaced(pr),
    threads: (pr.threads || []).map(adaptThread),
  };
}

// Bucket PRs into the three dashboard sections, matching server priority:
//   needs  — needsYou (disagreements, JIRA, conflicts)
//   auto   — has agree-fix work but doesn't need you
//   waiting— everything else
export function adaptSections(prs) {
  const adapted = prs.map((p) => ({ raw: p, ui: adaptPR(p) }));
  const needs = [], auto = [], waiting = [];
  for (const { raw, ui } of adapted) {
    // A surfaced branch-health reason means the worker already looked, couldn't
    // fix it (e.g. rebase gated on approval), and punted — the next actor is the
    // reviewer, so it waits. Don't count its CI/behind pills as "auto-handling".
    // Pending threads (worker hasn't judged them yet) are the agent's queue, so
    // they belong in auto-handling, not waiting-on-reviewer.
    if (raw.needsYou) needs.push(ui);
    else if (!ui.surfaced && (raw.autoFixable || raw.pending || ui.pills.some((p) => p.kind === 'ci' || p.kind === 'behind'))) auto.push(ui);
    else waiting.push(ui);
  }
  return [
    { key: 'needs', title: 'Needs you', needsYou: true, prs: needs },
    { key: 'auto', title: 'Auto-handling', needsYou: false, prs: auto },
    { key: 'waiting', title: 'Waiting on reviewer', needsYou: false, prs: waiting },
  ];
}

export function adaptState(state) {
  const prs = state?.prs || [];
  const sections = adaptSections(prs);
  return {
    sections,
    // `scope` is config.onlyPRs: empty = all PRs (full production), a list = the
    // daemon is restricted to those PR keys. The worker always acts on what it sees.
    scope: state?.scope || [],
    updatedAt: state?.updatedAt || null,
    openCount: prs.length,
    needCount: sections.find((s) => s.key === 'needs').prs.length,
  };
}
