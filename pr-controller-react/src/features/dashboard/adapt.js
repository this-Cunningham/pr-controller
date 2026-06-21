// Thin adapter from the backend's state.json to the shapes the vendored Wabi-Sabi
// design-system components consume. The daemon owns tab routing (it ships a flat
// `placements` list — see placements.mjs); this file does presentational mapping only:
//   - the backend disposition -> the DS short tag vocabulary
//   - per-PR/branch/thread -> DS prop shapes
//   - grouping the server's placement rows into per-lane cards + ordered items
//
// Backend state.json (new contract):
//   { updatedAt, scope, lanes:['needs','progress','waiting'],
//     prs: [{ repo, number, title, url, isDraft, reviewDecision, behindBase,
//             branchHealth:{failingChecks[]}, sortRank,
//             threads:[{ threadId, path, line, author, lastAuthor, body, disposition,
//                        reason, suggestedReply, suggestedApproach, error }] }],
//     placements: [{ prKey, lane, subjectKind, subjectId, disposition, reason, sortRank }] }

// Backend disposition -> DS thread tag (the DS's SHORT vocabulary:
// input | fixed | waiting | pending | praise | error). This is the ONLY routing-
// adjacent map left on the client, and it's purely cosmetic — the DS components are
// frozen on these names, so a thread carries one of them for styling.
export const DISPOSITION_TO_TAG = {
  needsYourApproval: 'input',
  agentAutoFixed: 'fixed',
  awaitingReviewer: 'waiting',
  notYetReviewed: 'pending',
  agentAcknowledged: 'praise',
  agentError: 'error',
};

// Branch placement -> generic BranchStatus presentation. `tone` picks the visual:
// 'agent' = ambient pulsing status line (a rebase actively running); 'attention' =
// boxed ◆ callout with optional details + action buttons. `actions` are label-bearing
// keys ({ key:'terminal'|'rebase', label }) that PRCard binds to controller methods —
// the label rides in the data so the card stays a pure renderer. A new branch state is
// a new case here — no change to the BranchStatus component.
function branchPresentation(row) {
  if (row.disposition === 'branchConflict' && row._rebasing)
    return { tone: 'agent', pulse: true, message: 'Resolving merge conflict — the agent is rebasing this branch.' };
  if (row.disposition === 'branchConflict')
    // One conflict card; the agent's explanation (if it surfaced one) rides along as
    // "Show details", and is simply absent otherwise.
    return { tone: 'attention', message: 'Merge conflict — the agent rebases it automatically when the branch changes; resolve it in a terminal if it’s stuck.', details: row.reason || undefined, actions: [{ key: 'terminal', label: 'Open in terminal' }] };
  if (row.disposition === 'branchOutOfSync')
    return { tone: 'attention', message: row.reason || 'The branch diverged from the remote — resolve it in a terminal.', actions: [{ key: 'terminal', label: 'Resolve in terminal' }] };
  return { tone: 'attention', message: row.reason };
}

const LANES = [
  { key: 'needs', title: 'Needs you' },
  { key: 'progress', title: 'In progress' },
  { key: 'waiting', title: 'Waiting on reviewer' },
];

const prKeyOf = (pr) => `${pr.repo}#${pr.number}`;

// Signal pills (decoration only — behind base, CI failing). Routing is unaffected.
function derivePills(pr) {
  const pills = [];
  if (pr.behindBase) pills.push({ label: 'behind base', kind: 'behind' });
  const ci = pr.branchHealth?.failingChecks || [];
  if (ci.length) pills.push({ label: `CI failing: ${ci.map((c) => c.name).join(', ')}`, kind: 'ci' });
  return pills;
}

// PR -> the metadata a card header needs. No threads/branch/jira routing fields:
// the card renders the `items` it's handed, nothing more.
export function adaptPRMeta(pr) {
  return {
    id: prKeyOf(pr),
    repo: pr.repo,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    review: pr.isDraft ? 'DRAFT' : pr.readyToMerge ? 'READY' : pr.reviewDecision === 'APPROVED' ? 'APPROVED' : 'REVIEW_REQUIRED',
    pills: derivePills(pr),
  };
}

// The worker emits ONE `reason` string per thread (worker-prompt.md output schema +
// rules.deriveDisposition) — there is no separately-authored "full" reasoning. So we
// derive an inline SUMMARY (a clamped first chunk) and only carry a distinct `reasonFull`
// (the complete text) when the reason is genuinely longer than the summary. When the
// reason already fits, `reasonFull` is undefined and ThreadRow hides the toggle entirely.
const REASON_CLAMP = 160;
function splitReason(reason) {
  const full = (reason || '').trim();
  if (!full) return { summary: '', reasonFull: undefined };
  // Prefer the first sentence if it's a clean, shorter lead-in.
  const sentenceEnd = full.search(/[.!?](\s|$)/);
  if (sentenceEnd > 0 && sentenceEnd + 1 < full.length - 1) {
    const firstSentence = full.slice(0, sentenceEnd + 1);
    if (firstSentence.length <= REASON_CLAMP)
      return { summary: firstSentence, reasonFull: full };
  }
  if (full.length <= REASON_CLAMP) return { summary: full, reasonFull: undefined };
  // Clamp to ~REASON_CLAMP chars on a word boundary, with an ellipsis.
  const slice = full.slice(0, REASON_CLAMP);
  const lastSpace = slice.lastIndexOf(' ');
  const summary = (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trimEnd() + '…';
  return { summary, reasonFull: full };
}

// One backend thread -> the DS Thread shape. `dispatched` (the user approved + ran
// this thread, worker not finished) shows it as `pending` so it reads as "agent
// reviewing now" while it's in flight — the one optimistic, client-only nuance.
export function adaptThread(t, { dispatched = false } = {}) {
  if (t.error) {
    // The full scan error rides in the body; the inline reason is a fixed caption,
    // so there's never extra reasoning to expand here. The scanner now classifies the
    // failure (rateLimit/auth/forbidden/graphql) so a throttle reads distinctly.
    const kind = t.errorKind && t.errorKind !== 'other' ? ` — ${t.errorKind}` : '';
    return { id: t.threadId || 'err', tag: 'error', loc: '', author: '', body: String(t.error || t.reason || ''), reasonSummary: `Scan error${kind}.`, reasonFull: undefined };
  }
  const author = t.lastAuthor && t.lastAuthor !== t.author ? t.lastAuthor : t.author;
  let tag = DISPOSITION_TO_TAG[t.disposition] || 'waiting';
  if (tag === 'input' && dispatched) tag = 'pending';
  const { summary, reasonFull } = splitReason(t.reason);
  return {
    id: t.threadId,
    tag,
    loc: `${t.path || ''}${t.line != null ? ':' + t.line : ''}`,
    author: author ? `@${author}` : '',
    body: t.body || '',
    reasonSummary: summary,
    reasonFull,
    approach: t.suggestedApproach || undefined,
    reply: t.suggestedReply || undefined,
  };
}

// Apply the two client-only overlays on top of the server's authoritative
// placements:
//   - a DISPATCHED thread (Run agent fired, worker not finished) moves Needs you ->
//     In progress immediately (state.json catches up when the worker exits).
//   - a WORKING PR (SSE in-flight set) with no other progress row gets a synthetic
//     "agent working" row, so a rebase-only/thread-less run still shows In progress.
function applyOverlays(placements, prs, overlays) {
  const isWorking = overlays.isWorking || (() => false);
  const isDispatched = overlays.isDispatched || (() => false);
  const isRebasing = overlays.isRebasing || (() => false);

  const rows = placements.map((r) => {
    // A dispatched (Run-fired) thread moves Needs you -> In progress immediately.
    if (r.subjectKind === 'thread' && r.lane === 'needs' && isDispatched(r.prKey, r.subjectId)) {
      return { ...r, lane: 'progress', _dispatched: true };
    }
    // A standing conflict lives in Needs you; show it In progress ("rebasing now")
    // ONLY while a rebase worker is actually in flight for this PR.
    if (r.disposition === 'branchConflict' && isRebasing(r.prKey)) {
      return { ...r, lane: 'progress', _rebasing: true };
    }
    return { ...r };
  });

  for (const pr of prs) {
    const key = prKeyOf(pr);
    if (isWorking(key) && !rows.some((r) => r.prKey === key && r.lane === 'progress')) {
      rows.push({ prKey: key, lane: 'progress', subjectKind: 'live', subjectId: 'live', disposition: 'agentWorking', reason: '', sortRank: 2 });
    }
  }
  return rows;
}

// Build the per-lane render items for one PR card from its placement rows in that
// lane. The card is a pure renderer — this decides WHAT it shows, in display order.
function buildItems(lane, pr, rows, overlays) {
  const isDispatched = overlays.isDispatched || (() => false);
  const threadById = new Map((pr.threads || []).map((t) => [t.threadId, t]));
  const ordered = [...rows].sort((a, b) => (a.sortRank ?? 9) - (b.sortRank ?? 9));

  const items = [];
  // In progress: lead with the ambient "agent working" line when real work is here
  // (threads or a live run). A plain conflict is self-describing via BranchStatus.
  if (lane === 'progress' && ordered.some((r) => r.subjectKind === 'thread' || r.subjectKind === 'live')) {
    items.push({ kind: 'agentWorking', text: 'Agent working — addressing this PR now.', tone: 'agent', pulse: true });
  }

  for (const r of ordered) {
    if (r.subjectKind === 'thread') {
      const t = threadById.get(r.subjectId);
      if (t) items.push({ kind: 'thread', thread: adaptThread(t, { dispatched: isDispatched(r.prKey, r.subjectId) }) });
    } else if (r.subjectKind === 'jira') {
      items.push({ kind: 'jira' });
    } else if (r.subjectKind === 'branch') {
      items.push({ kind: 'branch', branch: branchPresentation(r) });
    }
    // 'live' rows are represented by the agentWorking line above — no separate item.
  }
  return items;
}

// Group the server's flat placement rows (plus client overlays) into the three
// lanes, each carrying its PR cards (meta + ordered items), PRs ordered by urgency.
export function buildLanes(prs, placements, overlays = {}) {
  const prByKey = new Map(prs.map((p) => [prKeyOf(p), p]));
  const rows = applyOverlays(placements || [], prs, overlays);

  return LANES.map(({ key, title }) => {
    const laneRows = rows.filter((r) => r.lane === key);
    const byPr = new Map();
    for (const r of laneRows) {
      if (!byPr.has(r.prKey)) byPr.set(r.prKey, []);
      byPr.get(r.prKey).push(r);
    }
    const cards = [...byPr.entries()]
      .map(([prKey, prRows]) => {
        const pr = prByKey.get(prKey);
        if (!pr) return null;
        return {
          pr: adaptPRMeta(pr),
          items: buildItems(key, pr, prRows, overlays),
          sortRank: Math.min(...prRows.map((r) => (typeof r.sortRank === 'number' ? r.sortRank : 9))),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.sortRank - b.sortRank || a.pr.id.localeCompare(b.pr.id));
    return { key, title, prs: cards };
  });
}

// Strip state.json to the raw pieces the hook needs; lanes are computed reactively
// in useDashboard (they fold in client overlays, not just the fetch).
export function adaptState(state) {
  return {
    prs: state?.prs || [],
    placements: state?.placements || [],
    scope: state?.scope || [],
    updatedAt: state?.updatedAt || null,
    // null when the last scan succeeded; { at, message } when the daemon's poll failed
    // (so the dashboard can show a scan-failing indicator instead of a false all-clear).
    lastPollError: state?.lastPollError || null,
  };
}
