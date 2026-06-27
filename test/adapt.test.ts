// Locks the FRONTEND composition (pr-controller-react/src/features/dashboard/adapt.js): turning the
// daemon's server-authoritative `placements` + `prs` into per-lane cards with
// ordered render items, plus the two client-only overlays (dispatched / working).
// Tab ROUTING itself is owned by the daemon and locked in test/placements.test.ts;
// here we feed real placementsFor() output through buildLanes to prove the client
// groups + renders it faithfully and adds nothing of its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLanes, adaptThread, adaptPRMeta, adaptState, DISPOSITION_TO_TAG } from '../pr-controller-react/src/features/dashboard/adapt.js';
import { placementsFor } from '../placements.ts';
import type { Pr, Placement, ThreadDisposition } from '../types.ts';
import type { WirePr, WireThread } from '../pr-controller-react/src/features/dashboard/wire.ts';

// A thread override as the test data-builder accepts it — a loose subset of the wire
// thread (`id` maps to threadId; disposition/error/lastAuthor may be absent).
interface ThreadOverride {
  id?: string;
  disposition?: ThreadDisposition;
  reason?: string;
  error?: string;
  lastAuthor?: string;
}

// The overrides the pr() data-builder accepts — a subset of the wire PR fields the
// adapter + placements read, plus loose threads.
interface PrOverrides {
  repo?: string;
  number?: number;
  title?: string;
  isDraft?: boolean;
  reviewDecision?: string | null;
  needsJira?: boolean;
  behindBase?: boolean;
  needsRebase?: boolean;
  outOfSync?: boolean;
  workerSurfaced?: string | null;
  workerError?: string | null;
  readyToMerge?: boolean;
  branchHealth?: WirePr['branchHealth'] | { failingChecks: { name: string }[] };
  threads?: ThreadOverride[];
}

// The lane-render shape buildLanes emits (the adapter's output contract is internal,
// so the test mirrors the slice it asserts on). LaneItem is a permissive fixture shape
// — the variant fields are optional so the assertions can read them without narrowing.
interface LaneCard {
  pr: { id: string; review?: string; pills?: { kind: string }[] };
  items: LaneItem[];
}
interface LaneRender {
  key: string;
  title: string;
  prs: LaneCard[];
}
interface LaneItem {
  kind: 'agentWorking' | 'thread' | 'jira' | 'branch';
  thread?: { id: string; tag: string };
  branch?: { tone: string; message?: string; details?: string; actions?: unknown[] };
}

// A thread fixture as the test feeds it to adaptThread — a loose subset of WireThread,
// plus the scan-error stub's `errorKind` (carried on the wire stub, read via adapt's own
// narrow cast). Cast to WireThread at the call boundary.
type ThreadFixture = Partial<WireThread> & { errorKind?: string };
const wireThread = (fixture: ThreadFixture) => fixture as unknown as WireThread;

// A backend state.json PR record. `threads` take { id, disposition, error, lastAuthor }.
function pr(over: PrOverrides = {}): WirePr {
  // Test fixture: an intentionally partial wire-PR record carrying only the fields the
  // adapter + placementsFor read. Cast to WirePr (the adapter's input contract).
  return {
    repo: over.repo ?? 'site-vdp-remix',
    number: over.number ?? 1,
    title: over.title ?? 'Test PR',
    url: 'http://x',
    isDraft: over.isDraft ?? false,
    reviewDecision: over.reviewDecision ?? 'REVIEW_REQUIRED',
    needsJira: over.needsJira ?? false,
    behindBase: over.behindBase ?? false,
    needsRebase: over.needsRebase ?? false,
    outOfSync: over.outOfSync ?? false,
    workerSurfaced: over.workerSurfaced ?? null,
    workerError: over.workerError ?? null,
    readyToMerge: over.readyToMerge ?? false,
    branchHealth: over.branchHealth ?? { failingChecks: [] },
    threads: (over.threads || []).map((t, i) => ({
      threadId: t.id ?? `t${i}`, path: 'a.js', line: 1,
      author: 'reviewer', lastAuthor: t.lastAuthor ?? 'reviewer',
      body: 'x', disposition: t.disposition, reason: t.reason ?? 'r', error: t.error,
    })),
  } as unknown as WirePr;
}

// The client-only overlay predicates buildLanes threads through (mirror of adapt.ts's
// internal Overlays; not exported, so restated here for the test fixture).
interface Overlays {
  isWorking?: (prKey: string) => boolean;
  isDispatched?: (prKey: string, subjectId: string) => boolean;
  isRebasing?: (prKey: string) => boolean;
}

// Group backend PRs into lanes exactly as the runtime does: compute server
// placements (placementsFor), then build lanes on the client.
function lanesFrom(prs: WirePr[], overlays: Overlays = {}): Record<string, LaneRender> {
  // placementsFor's input contract is the daemon's derived Pr; the wire PR is the same
  // record on the wire, so cast the structurally-identical fixture for this boundary.
  const placements = prs.flatMap((p) => placementsFor(p as unknown as Pr)) as Placement[];
  return Object.fromEntries(
    (buildLanes(prs, placements, overlays) as unknown as LaneRender[]).map((l) => [l.key, l]),
  );
}
const cardIds = (lane: LaneRender) => lane.prs.map((c) => c.pr.id);
const itemsFor = (lane: LaneRender, prId: string): LaneItem[] =>
  (lane.prs.find((c) => c.pr.id === prId)?.items) || [];

test('buildLanes returns needs / progress / waiting in order', () => {
  const lanes = buildLanes([], [], {});
  assert.deepEqual(lanes.map((l) => l.key), ['needs', 'progress', 'waiting']);
  assert.deepEqual(lanes.map((l) => l.title), ['Needs you', 'In progress', 'Waiting on reviewer']);
});

test('DISPOSITION_TO_TAG maps the backend vocabulary to DS short tags', () => {
  assert.deepEqual(DISPOSITION_TO_TAG, {
    needsYourApproval: 'input', agentAutoFixed: 'fixed', awaitingReviewer: 'waiting',
    notYetReviewed: 'pending', agentAcknowledged: 'praise', agentError: 'error',
  });
});

test('adaptThread: disposition -> DS tag; a dispatched input reads as pending', () => {
  const base = wireThread({ threadId: 'a', disposition: 'needsYourApproval', path: 'a.js', line: 1, author: 'r', lastAuthor: 'r', reason: 'why', body: 'b' });
  assert.equal(adaptThread(base).tag, 'input');
  assert.equal(adaptThread(base, { dispatched: true }).tag, 'pending');
  assert.equal(adaptThread({ ...base, disposition: 'agentAutoFixed' }).tag, 'fixed');
  assert.equal(adaptThread(wireThread({ error: 'scan failed', threadId: 'e' })).tag, 'error');
});

// The worker emits ONE `reason` per thread; adapt.js used to copy it into both
// reasonSummary and reasonFull, which made the "Show agent's reasoning" toggle reveal
// identical text. Now reasonSummary is a clamped lead-in and reasonFull is set ONLY
// when there's genuinely more to read (otherwise undefined, so ThreadRow hides the toggle).
test('adaptThread: a short reason -> reasonSummary is the reason, reasonFull undefined (no toggle)', () => {
  const out = adaptThread(wireThread({ threadId: 'a', disposition: 'needsYourApproval', reason: 'Looks risky.', body: 'b' }));
  assert.equal(out.reasonSummary, 'Looks risky.');
  assert.equal(out.reasonFull, undefined);
});

test('adaptThread: a long single-sentence reason is clamped on a word boundary; reasonFull is the full text', () => {
  const reason = 'This change silently swallows the network error and returns an empty array instead, which means a transient failure will look exactly like an empty result set to every downstream caller and mask real outages from on-call';
  const out = adaptThread(wireThread({ threadId: 'a', disposition: 'needsYourApproval', reason, body: 'b' }));
  assert.ok(out.reasonSummary.length < reason.length, 'summary is shorter than the full reason');
  assert.ok(out.reasonSummary.endsWith('…'), 'clamped summary ends with an ellipsis');
  assert.ok(!out.reasonSummary.slice(0, -1).endsWith(' '), 'clamp lands on a word boundary');
  assert.equal(out.reasonFull, reason);
  assert.ok(reason.startsWith(out.reasonSummary.slice(0, -1).trimEnd()));
});

test('adaptThread: a multi-sentence reason -> summary is the first sentence, reasonFull is everything', () => {
  const reason = 'The diff drops the auth check. That is almost certainly a regression worth a second look before this merges.';
  const out = adaptThread(wireThread({ threadId: 'a', disposition: 'needsYourApproval', reason, body: 'b' }));
  assert.equal(out.reasonSummary, 'The diff drops the auth check.');
  assert.equal(out.reasonFull, reason);
});

test('adaptThread: an error thread has a fixed caption and no expandable reasoning', () => {
  const out = adaptThread(wireThread({ error: 'scan failed', threadId: 'e' }));
  assert.equal(out.reasonSummary, 'Scan error.');
  assert.equal(out.reasonFull, undefined);
});

test('a needsYourApproval thread -> one Needs-you card with an input thread item', () => {
  const l = lanesFrom([pr({ threads: [{ id: 'a', disposition: 'needsYourApproval' }] })]);
  assert.deepEqual(cardIds(l.needs), ['site-vdp-remix#1']);
  assert.equal(cardIds(l.progress).length, 0);
  const items = itemsFor(l.needs, 'site-vdp-remix#1');
  assert.deepEqual(items.map((i) => i.kind), ['thread']);
  assert.equal(items[0].thread!.tag, 'input');
});

test('a mixed PR renders as a card in all three lanes, each with its own item slice', () => {
  const l = lanesFrom([pr({ threads: [
    { id: 'surf', disposition: 'needsYourApproval' },
    { id: 'fix', disposition: 'agentAutoFixed' },
    { id: 'wip', disposition: 'notYetReviewed' },
  ] })]);
  const key = 'site-vdp-remix#1';
  assert.deepEqual(cardIds(l.needs), [key]);
  assert.deepEqual(cardIds(l.progress), [key]);
  assert.deepEqual(cardIds(l.waiting), [key]);
  // needs: the surfaced thread; waiting: the fixed thread
  assert.deepEqual(itemsFor(l.needs, key).filter((i) => i.kind === 'thread').map((i) => i.thread!.id), ['surf']);
  assert.deepEqual(itemsFor(l.waiting, key).filter((i) => i.kind === 'thread').map((i) => i.thread!.id), ['fix']);
  // progress: an ambient "agent working" line FIRST, then the un-judged thread
  const prog = itemsFor(l.progress, key);
  assert.equal(prog[0].kind, 'agentWorking');
  assert.deepEqual(prog.filter((i) => i.kind === 'thread').map((i) => i.thread!.id), ['wip']);
});

test('praise renders in no lane', () => {
  const l = lanesFrom([pr({ threads: [{ id: 'a', disposition: 'agentAcknowledged' }] })]);
  assert.equal(cardIds(l.needs).length + cardIds(l.progress).length + cardIds(l.waiting).length, 0);
});

test('needsJira -> a Needs-you card with a jira item', () => {
  const l = lanesFrom([pr({ needsJira: true })]);
  assert.deepEqual(itemsFor(l.needs, 'site-vdp-remix#1').map((i) => i.kind), ['jira']);
});

test('outOfSync -> a Needs-you branch item (attention, terminal action)', () => {
  const l = lanesFrom([pr({ outOfSync: true })]);
  const items = itemsFor(l.needs, 'site-vdp-remix#1');
  assert.deepEqual(items.map((i) => i.kind), ['branch']);
  assert.equal(items[0].branch!.tone, 'attention');
  assert.deepEqual(items[0].branch!.actions, [{ key: 'terminal', kind: 'outOfSync', label: 'Resolve in terminal' }]);
});

test('workerFailed -> a Needs-you branch item with Re-run + Open-in-terminal actions', () => {
  const l = lanesFrom([pr({ workerError: 'The worker run finished but produced no usable result.' })]);
  const items = itemsFor(l.needs, 'site-vdp-remix#1');
  const branch = items.find((i) => i.kind === 'branch')!;
  assert.equal(branch.branch!.tone, 'attention');
  assert.match(branch.branch!.message!, /no usable result/);
  assert.deepEqual(branch.branch!.actions, [
    { key: 'rerun', label: 'Re-run' },
    { key: 'terminal', kind: 'workerFailed', label: 'Open in terminal', variant: 'text' },
  ]);
});

test('overlay: a workerFailed card drops out of Needs you while a re-run worker is in flight', () => {
  const key = 'site-vdp-remix#1';
  const l = lanesFrom([pr({ workerError: 'The worker run failed.' })], { isWorking: (prId) => prId === key });
  assert.equal(cardIds(l.needs).length, 0);                                  // not "needs you" — being re-attempted
  assert.deepEqual(cardIds(l.progress), [key]);                             // shows In progress instead
  assert.deepEqual(itemsFor(l.progress, key).map((i) => i.kind), ['agentWorking']);
});

test('surfaced wins over a conflict -> Needs-you branch item, not In progress', () => {
  const l = lanesFrom([pr({ workerSurfaced: 'rebase too risky', needsRebase: true })]);
  const items = itemsFor(l.needs, 'site-vdp-remix#1');
  assert.equal(items[0].branch!.tone, 'attention');
  assert.equal(items[0].branch!.details, 'rebase too risky'); // agent's reason behind "Show details"
  assert.deepEqual(items[0].branch!.actions, [{ key: 'terminal', kind: 'conflict', label: 'Open in terminal' }]);
  assert.equal(cardIds(l.progress).length, 0);
});

test('a standing conflict (no active rebase) -> Needs you, actionable "resolve it" card', () => {
  const l = lanesFrom([pr({ needsRebase: true })]);
  assert.deepEqual(cardIds(l.needs), ['site-vdp-remix#1']);
  assert.equal(cardIds(l.progress).length, 0);
  const branch = itemsFor(l.needs, 'site-vdp-remix#1').find((i) => i.kind === 'branch')!;
  assert.equal(branch.branch!.tone, 'attention');                // actionable, not a fake rebasing pulse
  assert.deepEqual(branch.branch!.actions, [{ key: 'terminal', kind: 'conflict', label: 'Open in terminal' }]); // resolve by hand; the agent auto-rebases or surfaces
  assert.match(branch.branch!.message!, /Merge conflict/);
  assert.equal(branch.branch!.details, undefined);               // no agent explanation -> no "Show details"
});

test('a conflict WITH a rebase worker in flight -> In progress, "rebasing now" card', () => {
  const key = 'site-vdp-remix#1';
  const l = lanesFrom([pr({ needsRebase: true })], { isRebasing: (prId) => prId === key });
  assert.deepEqual(cardIds(l.progress), [key]);
  assert.equal(cardIds(l.needs).length, 0);
  assert.equal(itemsFor(l.progress, key).find((i) => i.kind === 'branch')!.branch!.tone, 'agent'); // ambient "rebasing now"
});

test('overlay: a dispatched approval moves the thread Needs-you -> In progress (as pending)', () => {
  const key = 'site-vdp-remix#1';
  const l = lanesFrom([pr({ threads: [{ id: 'a', disposition: 'needsYourApproval' }] })], {
    isDispatched: (prId, tId) => prId === key && tId === 'a',
  });
  assert.equal(cardIds(l.needs).length, 0);
  assert.deepEqual(cardIds(l.progress), [key]);
  const thread = itemsFor(l.progress, key).find((i) => i.kind === 'thread')!.thread!;
  assert.equal(thread.tag, 'pending');
});

test('overlay: a working PR with no threads gets an In-progress card with an agent-working line', () => {
  const key = 'site-vdp-remix#1';
  const l = lanesFrom([pr({ threads: [] })], { isWorking: (prId) => prId === key });
  assert.deepEqual(cardIds(l.progress), [key]);
  assert.deepEqual(itemsFor(l.progress, key).map((i) => i.kind), ['agentWorking']);
});

test('adaptPRMeta: draft -> DRAFT review; CI failing -> a ci pill', () => {
  const meta = adaptPRMeta(pr({ isDraft: true, branchHealth: { failingChecks: [{ name: 'unit' }] } }));
  assert.equal(meta.review, 'DRAFT');
  assert.ok(meta.pills.some((p) => p.kind === 'ci'));
});

test('adaptPRMeta: a ready-to-merge PR -> READY badge (a PR-level status, not a lane)', () => {
  assert.equal(adaptPRMeta(pr({ readyToMerge: true })).review, 'READY');
  assert.equal(adaptPRMeta(pr({ readyToMerge: true, reviewDecision: 'APPROVED' })).review, 'READY'); // READY supersedes APPROVED
  assert.equal(adaptPRMeta(pr({ readyToMerge: true, isDraft: true })).review, 'DRAFT');               // draft still wins
});

test('cards within a lane are ordered by urgency (surfaced/approval before error)', () => {
  const a = pr({ number: 1, threads: [{ id: 'a', disposition: 'needsYourApproval' }] }); // rank 0
  const b = pr({ number: 2, threads: [{ id: 'b', disposition: 'agentError' }] });        // rank 1
  const l = lanesFrom([b, a]); // intentionally out of order
  assert.deepEqual(cardIds(l.needs), ['site-vdp-remix#1', 'site-vdp-remix#2']);
});

// Observability surfacing (item 7): the daemon's poll failure rides in state.json as
// lastPollError so the header can show a scan-failing indicator; adaptState passes it
// through (defaulting to null when the last scan was healthy).
test('adaptState: passes lastPollError through, defaulting to null', () => {
  assert.equal(adaptState({ prs: [], placements: [] }).lastPollError, null);
  assert.equal(adaptState(null).lastPollError, null);
  const err = { at: '2026-06-21T00:00:00Z', message: 'API rate limit exceeded' };
  assert.deepEqual(adaptState({ lastPollError: err }).lastPollError, err);
});

// A classified scan error surfaces its kind in the inline caption (throttle reads
// distinctly from a generic error); an unclassified/other error stays a plain caption.
test('adaptThread: a classified scan error surfaces its kind', () => {
  assert.equal(adaptThread(wireThread({ threadId: 'e', error: 'boom', errorKind: 'rateLimit' })).reasonSummary, 'Scan error — rateLimit.');
  assert.equal(adaptThread(wireThread({ threadId: 'e', error: 'boom', errorKind: 'auth' })).reasonSummary, 'Scan error — auth.');
  assert.equal(adaptThread(wireThread({ threadId: 'e', error: 'boom', errorKind: 'other' })).reasonSummary, 'Scan error.');
  assert.equal(adaptThread(wireThread({ threadId: 'e', error: 'boom' })).reasonSummary, 'Scan error.');
});
