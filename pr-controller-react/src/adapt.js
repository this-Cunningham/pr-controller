// Adapts the pr-controller backend's state.json into the shape the design
// components expect. The pipeline is the source of truth for DATA; this file
// reshapes it for the UI (per project decision: optimize the React side, not
// the pipeline). Keep this the ONLY translation point.
//
// Backend PR shape (state.json):
//   { number, title, repo, nameWithOwner, url, isDraft, reviewDecision,
//     needsYou, needsJira, behindBase, ciFailing, needsRebase, outOfSync, autoFixable, pending,
//     workerSurfaced, branchHealth: { failingChecks[], complianceChecks[] },
//     threads: [{ threadId, path, line, author, body, lastAuthor, tier, reason, error }] }
//   tier is derived from the worker's verdict (rules.deriveTier) and is the shared
//   DISPOSITION vocabulary used end-to-end: needsYourApproval | agentAutoFixed |
//   agentAcknowledged | awaitingReviewer | notYetReviewed | agentError
//
// UI PR shape (what components consume):
//   { id, repo, number, title, review, jira, pills[], surfaced, threads[] }
//   thread: { id, tag, loc, author, body, reason }  — `tag` IS the disposition name.

// Per-PR branch health, given the same first-class shape the threads already have:
// a list of { kind, severity, label, cta?, detail? } signals derived in ONE place,
// instead of the scattered booleans (needsYou/needsJira/needsRebase/outOfSync/
// behindBase/autoFixable/pending/workerSurfaced) each consumer used to cherry-pick.
//   severity ordering (most urgent first): needsYou > auto > info
//     needsYou — you must act before the agent can continue
//     auto     — the agent is handling it (or will); no action from you
//     info     — purely informational
// Everything downstream (pills, the surfaced banner, needsYou, the section bucket)
// derives from this list, so there is one source of truth for PR-level status.
//
// The `!surfaced` guard around the auto block reproduces EXACTLY the old
// `!ui.surfaced && (...)` guard in adaptSections: when the worker surfaced a
// branch-health reason it already tried and bailed, so its CI/behind/rebase signals
// are not "auto-handling" — the PR floats to "needs you" on the surfaced signal alone.
export function deriveHealthSignals(raw) {
  const signals = [];
  const h = raw.branchHealth || {};
  const ci = h.failingChecks || [];
  const surfaced = raw.workerSurfaced || null;

  // needsYou — blocks the agent until you act
  if (raw.needsJira)
    signals.push({ kind: 'needsJira', severity: 'needsYou', label: 'needs ticket', cta: 'setJira' });
  if (raw.outOfSync)
    signals.push({ kind: 'outOfSync', severity: 'needsYou', label: 'branch out of sync', cta: 'resolveTerminal',
      detail: 'The branch diverged from the remote — the agent could not fast-forward.' });
  if (surfaced)
    signals.push({ kind: 'surfaced', severity: 'needsYou', label: 'agent surfaced', detail: surfaced });

  // auto — the agent handles these; suppressed entirely when the worker surfaced
  // (it already bailed, so these are not in-flight auto-handling work).
  if (!surfaced) {
    if (raw.needsRebase)
      signals.push({ kind: 'needsRebase', severity: 'auto', label: 'merge conflict', cta: 'rebase' });
    if (ci.length)
      signals.push({ kind: 'ci', severity: 'auto', label: `CI failing: ${ci.map((c) => c.name).join(', ')}` });
    if (raw.behindBase)
      signals.push({ kind: 'behindBase', severity: 'auto', label: 'behind base' });
    if (raw.autoFixable)
      signals.push({ kind: 'autoFixable', severity: 'auto', label: `${raw.autoFixable} auto-fixable` });
  }

  // info — bucketing only (the pending count drives the "auto" section but renders
  // no pill, matching prior behavior).
  if (raw.pending)
    signals.push({ kind: 'pending', severity: 'info', label: `${raw.pending} pending` });

  return signals;
}

// Badge-class signal kinds become the PR's pill row. kind -> StatusPill `kind`
// (pillMeta key). The set + labels are identical to the old adaptPills output.
const PILL_KIND = { autoFixable: 'auto', behindBase: 'behind', ci: 'ci' };

function adaptThread(t, i) {
  if (t.error) {
    return { id: `err-${i}`, tag: 'agentError', loc: '', author: '', body: String(t.error), reason: 'Scan error.' };
  }
  // lastAuthor (who replied last) differs from author (who opened the thread)
  // once the conversation has moved; show it so a replied-to thread doesn't look stale.
  const author = t.lastAuthor && t.lastAuthor !== t.author ? t.lastAuthor : t.author;
  return {
    id: t.threadId,
    // `tag` is the disposition name straight from the backend tier — one vocabulary.
    tag: t.tier || 'awaitingReviewer',
    loc: `${t.path || ''}${t.line != null ? ':' + t.line : ''}`,
    author: author ? `@${author}` : '',
    body: t.body || '',
    reason: t.reason || '',
    // Worker-drafted helpers on surfaced threads (Phase 1 / Phase 2).
    suggestedReply: t.suggestedReply || '',
    suggestedApproach: t.suggestedApproach || '',
  };
}

// Badge-class signals -> the pill row, in the canonical display order
// (auto, then behind, then ci) the UI has always used.
const PILL_ORDER = ['autoFixable', 'behindBase', 'ci'];
function pillsFromSignals(signals) {
  return PILL_ORDER
    .map((kind) => signals.find((s) => s.kind === kind))
    .filter(Boolean)
    .map((s) => ({ label: s.label, kind: PILL_KIND[s.kind] }));
}

export function adaptPR(pr) {
  const healthSignals = deriveHealthSignals(pr);
  return {
    id: `${pr.repo}#${pr.number}`,
    repo: pr.repo,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    review: pr.isDraft ? 'DRAFT' : pr.reviewDecision === 'APPROVED' ? 'APPROVED' : 'REVIEW_REQUIRED',
    jira: !!pr.needsJira,
    // A genuine merge conflict the worker didn't auto-resolve (nothing else was
    // queued, so we don't force-push a quiet PR) — drives the manual Rebase CTA.
    needsRebase: !!pr.needsRebase,
    // The branch diverged from the remote (force-push/rebase) so the worktree
    // couldn't fast-forward and the agent never ran — hand-resolve in a terminal.
    outOfSync: !!pr.outOfSync,
    // PR-level status, all derived from the one signal list:
    healthSignals,
    pills: pillsFromSignals(healthSignals),
    // The worker surfaced a branch-health reason it couldn't (or wasn't allowed to)
    // fix and punted to you — rendered as a banner.
    surfaced: healthSignals.find((s) => s.kind === 'surfaced')?.detail || null,
    threads: (pr.threads || []).map(adaptThread),
  };
}

// Route ONE thread's disposition to a tab key, given the action overlays.
//   needsYourApproval -> needs (your call) — UNLESS you approved + Run began
//                        (dispatched), which moves it to In progress mid-flight.
//   agentError        -> needs
//   notYetReviewed    -> auto (In progress — the agent will judge it)
//   agentAutoFixed    -> waiting (replied `fixed`, left open; the reviewer's move)
//   awaitingReviewer  -> waiting
//   agentAcknowledged -> null (praise: reacted 🎉, never occupies a tab)
function threadTab(thread, prId, isDispatched) {
  switch (thread.tag) {
    case 'agentAcknowledged': return null;
    case 'needsYourApproval': return isDispatched(prId, thread.id) ? 'auto' : 'needs';
    case 'agentError': return 'needs';
    case 'notYetReviewed': return 'auto';
    default: return 'waiting';  // agentAutoFixed, awaitingReviewer
  }
}

// Per-ITEM tab routing. The unit of placement is the item (a thread or a PR-health
// signal), NOT the PR card — so one PR can appear in several tabs, each rendering
// only the slice of items that belong there. Each emitted slice is a full PR-shape
// object (so PRCard renders it unchanged); the chrome each tab owns is scoped:
//   needs    — needsYou threads + the surfaced banner / JIRA banner / outOfSync.
//   auto     — notYetReviewed + dispatched threads + CI/behind pills + an
//              auto-rebasing conflict. (The "N auto-fixable" count pill is dropped:
//              those threads now show as real rows in Waiting.)
//   waiting  — agentAutoFixed + awaitingReviewer threads only.
// `overlays.isWorking(prId)` / `overlays.isDispatched(prId,threadId)` come from the
// frontend SSE/cart state, so routing reacts to in-flight work before state.json
// catches up (a just-approved thread leaves Needs-you the instant Run fires).
export function adaptSections(prs, overlays = {}) {
  const isWorking = overlays.isWorking || (() => false);
  const isDispatched = overlays.isDispatched || (() => false);
  const needs = [], auto = [], waiting = [];

  for (const raw of prs) {
    const ui = adaptPR(raw);

    const buckets = { needs: [], auto: [], waiting: [] };
    for (const t of ui.threads) {
      const tab = threadTab(t, ui.id, isDispatched);
      if (tab) buckets[tab].push(t);
    }

    // PR-health items route by severity: needsYou signals (needsJira/outOfSync/
    // surfaced) -> needs; the agent's in-flight branch work (CI/behind/rebase) ->
    // In progress. autoFixable/pending are derived COUNTS, not routable items.
    const healthNeeds = ui.healthSignals.some((s) => s.severity === 'needsYou');
    const healthAuto = ui.healthSignals.some(
      (s) => s.kind === 'ci' || s.kind === 'behindBase' || s.kind === 'needsRebase'
    );

    if (buckets.needs.length || healthNeeds)
      needs.push({ ...ui, threads: buckets.needs, pills: [], needsRebase: false });

    if (buckets.auto.length || healthAuto || isWorking(ui.id))
      auto.push({
        ...ui,
        threads: buckets.auto,
        surfaced: null, jira: false, outOfSync: false,
        pills: ui.pills.filter((p) => p.kind !== 'auto'),
      });

    if (buckets.waiting.length)
      waiting.push({
        ...ui,
        threads: buckets.waiting,
        pills: [], surfaced: null, jira: false, outOfSync: false, needsRebase: false,
      });
  }

  return [
    { key: 'needs', title: 'Needs you', needsYou: true, prs: needs },
    { key: 'auto', title: 'In progress', needsYou: false, prs: auto },
    { key: 'waiting', title: 'Waiting on reviewer', needsYou: false, prs: waiting },
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
