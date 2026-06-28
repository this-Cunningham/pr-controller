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

import type {
  Disposition,
  Tag,
  Lane,
  Placement,
  WirePr,
  WireThread,
  StateJson,
  Approach,
} from './wire.ts';

// ── Adapter-output shapes (the DS prop shapes this file produces; the DS components are
//    frozen .jsx consumed untyped, so these output contracts live here, not in wire.ts) ──

/** A signal pill (decoration only). */
interface Pill {
  label: string;
  kind: 'behind' | 'ci';
}

/** PR card header metadata (adaptPRMeta output). */
interface PRMeta {
  id: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  review: 'DRAFT' | 'READY' | 'APPROVED' | 'REVIEW_REQUIRED';
  pills: Pill[];
}

/** A DS Thread render shape (adaptThread output). */
interface AdaptedThread {
  id: string;
  tag: Tag;
  loc: string;
  author: string;
  body: string;
  reasonSummary: string;
  reasonFull?: string;
  approach?: string;
  /** Multi-approach alternatives (input threads) — rendered as selectable radio-cards;
   *  supersede the single `approach` when present. */
  approaches?: Approach[];
  reply?: string;
}

/** A branch-status action button descriptor. */
interface BranchAction {
  key: 'terminal' | 'rebase' | 'rerun';
  label: string;
  kind?: string;
  variant?: string;
}

/** BranchStatus presentation (branchPresentation output). */
interface BranchPresentation {
  tone: 'agent' | 'attention';
  message?: string;
  pulse?: boolean;
  details?: string;
  actions?: BranchAction[];
}

/** A placement row plus the client-only overlay flags applyOverlays may stamp on. */
interface OverlayRow extends Placement {
  _dispatched?: boolean;
  _rebasing?: boolean;
}

/** The client-only overlay predicates threaded through buildLanes. */
interface Overlays {
  isWorking?: (prKey: string) => boolean;
  isDispatched?: (prKey: string, subjectId: string) => boolean;
  isRebasing?: (prKey: string) => boolean;
}

/** A render item for a lane card (the DS PRCard consumes these untyped). */
type LaneItem =
  | { kind: 'agentWorking'; text: string; tone: 'agent'; pulse: boolean }
  | { kind: 'thread'; thread: AdaptedThread }
  | { kind: 'jira' }
  | { kind: 'branch'; branch: BranchPresentation };

interface LaneCard {
  pr: PRMeta;
  items: LaneItem[];
  sortRank: number;
}

interface LaneRender {
  key: Lane;
  title: string;
  prs: LaneCard[];
}

// Backend disposition -> DS thread tag (the DS's SHORT vocabulary:
// input | fixed | waiting | pending | praise | error). This is the ONLY routing-
// adjacent map left on the client, and it's purely cosmetic — the DS components are
// frozen on these names, so a thread carries one of them for styling.
// Only the thread-level dispositions get a tag; pseudo-dispositions never reach a
// thread row, so this is a Partial map and the lookup falls back to 'waiting'.
export const DISPOSITION_TO_TAG: Partial<Record<Disposition, Tag>> = {
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
function branchPresentation(row: OverlayRow): BranchPresentation {
  if (row.disposition === 'branchConflict' && row._rebasing)
    return { tone: 'agent', pulse: true, message: 'Resolving merge conflict — the agent is rebasing this branch.' };
  if (row.disposition === 'branchConflict')
    // One conflict card; the agent's explanation (if it surfaced one) rides along as
    // "Show details", and is simply absent otherwise. `kind` picks the terminal opener.
    return { tone: 'attention', message: 'Merge conflict — the agent rebases it automatically when the branch changes; resolve it in a terminal if it’s stuck.', details: row.reason || undefined, actions: [{ key: 'terminal', kind: 'conflict', label: 'Open in terminal' }] };
  if (row.disposition === 'branchOutOfSync')
    return { tone: 'attention', message: row.reason || 'The branch diverged from the remote — resolve it in a terminal.', actions: [{ key: 'terminal', kind: 'outOfSync', label: 'Resolve in terminal' }] };
  if (row.disposition === 'workerFailed')
    // A run that came back without a usable result. Re-run re-dispatches it through the
    // daemon (a clean run clears this card); Open in terminal resumes the PR's session so
    // you can investigate / drive it by hand.
    return { tone: 'attention', message: row.reason || 'The worker run failed — see the daemon log.',
      actions: [
        { key: 'rerun', label: 'Re-run' },
        { key: 'terminal', kind: 'workerFailed', label: 'Open in terminal', variant: 'text' },
      ] };
  return { tone: 'attention', message: row.reason };
}

// The lane render config: KEYS mirror the server-authoritative vocabulary (placements.mjs
// `LANES`, the one routing home); this file owns only the display TITLES. The app stays
// self-contained (no out-of-root imports — see vite.config), so the keys are restated here
// rather than imported from the backend; they must match placements.mjs's LANES order.
const LANES: { key: Lane; title: string }[] = [
  { key: 'needs', title: 'Needs you' },
  { key: 'progress', title: 'In progress' },
  { key: 'waiting', title: 'Waiting on reviewer' },
];

const prKeyOf = (pr: WirePr) => `${pr.repo}#${pr.number}`;

// Signal pills (decoration only — behind base, CI failing). Routing is unaffected.
function derivePills(pr: WirePr): Pill[] {
  const pills: Pill[] = [];
  if (pr.behindBase) pills.push({ label: 'behind base', kind: 'behind' });
  const ci = pr.branchHealth?.failingChecks || [];
  if (ci.length) pills.push({ label: `CI failing: ${ci.map((c) => c.name).join(', ')}`, kind: 'ci' });
  return pills;
}

// PR -> the metadata a card header needs. No threads/branch/jira routing fields:
// the card renders the `items` it's handed, nothing more.
export function adaptPRMeta(pr: WirePr): PRMeta {
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
function splitReason(reason: string | undefined): { summary: string; reasonFull: string | undefined } {
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
export function adaptThread(t: WireThread, { dispatched = false }: { dispatched?: boolean } = {}): AdaptedThread {
  if (t.error) {
    // The full scan error rides in the body; the inline reason is a fixed caption,
    // so there's never extra reasoning to expand here. The scanner now classifies the
    // failure (rateLimit/auth/forbidden/graphql) so a throttle reads distinctly.
    // `errorKind` rides along on the scan-error stub but isn't on the wire contract;
    // read it via a narrow optional cast so the caption can specialise the message.
    const errorKind = (t as { errorKind?: string }).errorKind;
    const kind = errorKind && errorKind !== 'other' ? ` — ${errorKind}` : '';
    return { id: t.threadId || 'err', tag: 'error', loc: '', author: '', body: String(t.error || t.reason || ''), reasonSummary: `Scan error${kind}.`, reasonFull: undefined };
  }
  const author = t.lastAuthor && t.lastAuthor !== t.author ? t.lastAuthor : t.author;
  let tag: Tag = (t.disposition && DISPOSITION_TO_TAG[t.disposition]) || 'waiting';
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
    approaches: t.approaches && t.approaches.length ? t.approaches : undefined,
    reply: t.suggestedReply || undefined,
  };
}

// Apply the client-only overlays on top of the server's authoritative placements:
//   - a DISPATCHED thread (Run agent fired, worker not finished) moves Needs you ->
//     In progress immediately (state.json catches up when the worker exits).
//   - a WORKERFAILED card whose PR has a worker in flight (you clicked Re-run) drops
//     out of Needs you while the re-run runs — it's being worked on, not waiting on you.
//   - a WORKING PR (SSE in-flight set) with no other progress row gets a synthetic
//     "agent working" row, so a rebase-only/thread-less run still shows In progress.
function applyOverlays(placements: Placement[], prs: WirePr[], overlays: Overlays): OverlayRow[] {
  const isWorking = overlays.isWorking || (() => false);
  const isDispatched = overlays.isDispatched || (() => false);
  const isRebasing = overlays.isRebasing || (() => false);

  const rows: OverlayRow[] = placements.flatMap((r): OverlayRow[] => {
    if (r.subjectKind === 'thread' && r.lane === 'needs' && isDispatched(r.prKey, r.subjectId)) {
      return [{ ...r, lane: 'progress', _dispatched: true }];
    }
    // A worker is in flight for this PR (e.g. you clicked Re-run on the failed card), so
    // the failure is being re-attempted NOW — drop the workerFailed card from Needs you
    // until the run settles. The PR still shows In progress (its thread row, or the
    // synthetic "agent working" row below). state.json is authoritative on worker exit:
    // a clean run drops the row for good; a failed run re-asserts it and it returns here.
    if (r.disposition === 'workerFailed' && isWorking(r.prKey)) {
      return [];
    }
    // A standing conflict lives in Needs you; show it In progress ("rebasing now")
    // ONLY while a rebase worker is actually in flight for this PR.
    if (r.disposition === 'branchConflict' && isRebasing(r.prKey)) {
      return [{ ...r, lane: 'progress', _rebasing: true }];
    }
    return [{ ...r }];
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
function buildItems(lane: Lane, pr: WirePr, rows: OverlayRow[], overlays: Overlays): LaneItem[] {
  const isDispatched = overlays.isDispatched || (() => false);
  const threadById = new Map<string, WireThread>((pr.threads || []).map((t) => [t.threadId, t]));
  const ordered = [...rows].sort((a, b) => (a.sortRank ?? 9) - (b.sortRank ?? 9));

  const items: LaneItem[] = [];
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
export function buildLanes(prs: WirePr[], placements: Placement[], overlays: Overlays = {}): LaneRender[] {
  const prByKey = new Map<string, WirePr>(prs.map((p) => [prKeyOf(p), p]));
  const rows = applyOverlays(placements || [], prs, overlays);

  return LANES.map(({ key, title }) => {
    const laneRows = rows.filter((r) => r.lane === key);
    const byPr = new Map<string, OverlayRow[]>();
    for (const r of laneRows) {
      if (!byPr.has(r.prKey)) byPr.set(r.prKey, []);
      byPr.get(r.prKey)!.push(r);
    }
    const cards = [...byPr.entries()]
      .map(([prKey, prRows]): LaneCard | null => {
        const pr = prByKey.get(prKey);
        if (!pr) return null;
        return {
          pr: adaptPRMeta(pr),
          items: buildItems(key, pr, prRows, overlays),
          sortRank: Math.min(...prRows.map((r) => (typeof r.sortRank === 'number' ? r.sortRank : 9))),
        };
      })
      .filter((c): c is LaneCard => c !== null)
      .sort((a, b) => a.sortRank - b.sortRank || a.pr.id.localeCompare(b.pr.id));
    return { key, title, prs: cards };
  });
}

// Strip state.json to the raw pieces the hook needs; lanes are computed reactively
// in useDashboard (they fold in client overlays, not just the fetch).
export function adaptState(state: Partial<StateJson> | null | undefined) {
  return {
    prs: state?.prs || [],
    placements: state?.placements || [],
    scope: state?.scope || [],
    account: state?.account || null,   // the gh account PR discovery ran as (@me) — scan provenance
    updatedAt: state?.updatedAt || null,
    // null when the last scan succeeded; { at, message } when the daemon's poll failed
    // (so the dashboard can show a scan-failing indicator instead of a false all-clear).
    lastPollError: state?.lastPollError || null,
    // The daemon's arm switch — false until a human turns polling on (and false again
    // after every restart). The header renders this and POSTs /polling to flip it.
    pollingEnabled: state?.pollingEnabled ?? false,
    // Server-authoritative config for the Settings panel + the worker-sensitivity levels.
    // The app renders these and POSTs /config to edit; it derives no config of its own.
    settings: state?.settings || null,
    sensitivityLevels: state?.sensitivityLevels || [],
  };
}
