// Locks the FRONTEND composition (pr-controller-react/src/adapt.js): turning the
// daemon's server-authoritative `placements` + `prs` into per-lane cards with
// ordered render items, plus the two client-only overlays (dispatched / working).
// Tab ROUTING itself is owned by the daemon and locked in test/placements.test.mjs;
// here we feed real placementsFor() output through buildLanes to prove the client
// groups + renders it faithfully and adds nothing of its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLanes, adaptThread, adaptPRMeta, DISPOSITION_TO_TAG } from '../pr-controller-react/src/adapt.js';
import { placementsFor } from '../placements.mjs';

// A backend state.json PR record. `threads` take { id, disposition, error, lastAuthor }.
function pr(over = {}) {
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
    branchHealth: over.branchHealth ?? { failingChecks: [] },
    threads: (over.threads || []).map((t, i) => ({
      threadId: t.id ?? `t${i}`, path: 'a.js', line: 1,
      author: 'reviewer', lastAuthor: t.lastAuthor ?? 'reviewer',
      body: 'x', disposition: t.disposition, reason: t.reason ?? 'r', error: t.error,
    })),
  };
}

// Group backend PRs into lanes exactly as the runtime does: compute server
// placements (placementsFor), then build lanes on the client.
function lanesFrom(prs, overlays = {}) {
  const placements = prs.flatMap((p) => placementsFor(p));
  return Object.fromEntries(buildLanes(prs, placements, overlays).map((l) => [l.key, l]));
}
const cardIds = (lane) => lane.prs.map((c) => c.pr.id);
const itemsFor = (lane, prId) => (lane.prs.find((c) => c.pr.id === prId)?.items) || [];

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
  const t = { threadId: 'a', disposition: 'needsYourApproval', path: 'a.js', line: 1, author: 'r', lastAuthor: 'r', reason: 'why', body: 'b' };
  assert.equal(adaptThread(t).tag, 'input');
  assert.equal(adaptThread(t, { dispatched: true }).tag, 'pending');
  assert.equal(adaptThread({ ...t, disposition: 'agentAutoFixed' }).tag, 'fixed');
  assert.equal(adaptThread({ error: 'scan failed', threadId: 'e' }).tag, 'error');
});

test('a needsYourApproval thread -> one Needs-you card with an input thread item', () => {
  const l = lanesFrom([pr({ threads: [{ id: 'a', disposition: 'needsYourApproval' }] })]);
  assert.deepEqual(cardIds(l.needs), ['site-vdp-remix#1']);
  assert.equal(cardIds(l.progress).length, 0);
  const items = itemsFor(l.needs, 'site-vdp-remix#1');
  assert.deepEqual(items.map((i) => i.kind), ['thread']);
  assert.equal(items[0].thread.tag, 'input');
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
  assert.deepEqual(itemsFor(l.needs, key).filter((i) => i.kind === 'thread').map((i) => i.thread.id), ['surf']);
  assert.deepEqual(itemsFor(l.waiting, key).filter((i) => i.kind === 'thread').map((i) => i.thread.id), ['fix']);
  // progress: an ambient "agent working" line FIRST, then the un-judged thread
  const prog = itemsFor(l.progress, key);
  assert.equal(prog[0].kind, 'agentWorking');
  assert.deepEqual(prog.filter((i) => i.kind === 'thread').map((i) => i.thread.id), ['wip']);
});

test('praise renders in no lane', () => {
  const l = lanesFrom([pr({ threads: [{ id: 'a', disposition: 'agentAcknowledged' }] })]);
  assert.equal(cardIds(l.needs).length + cardIds(l.progress).length + cardIds(l.waiting).length, 0);
});

test('needsJira -> a Needs-you card with a jira item', () => {
  const l = lanesFrom([pr({ needsJira: true })]);
  assert.deepEqual(itemsFor(l.needs, 'site-vdp-remix#1').map((i) => i.kind), ['jira']);
});

test('outOfSync -> a Needs-you branch item (kind outofsync)', () => {
  const l = lanesFrom([pr({ outOfSync: true })]);
  const items = itemsFor(l.needs, 'site-vdp-remix#1');
  assert.deepEqual(items.map((i) => i.kind), ['branch']);
  assert.equal(items[0].branch.kind, 'outofsync');
});

test('surfaced wins over a conflict -> Needs-you branch item, not In progress', () => {
  const l = lanesFrom([pr({ workerSurfaced: 'rebase too risky', needsRebase: true })]);
  const items = itemsFor(l.needs, 'site-vdp-remix#1');
  assert.equal(items[0].branch.kind, 'surfaced');
  assert.equal(items[0].branch.details, 'rebase too risky');
  assert.equal(cardIds(l.progress).length, 0);
});

test('a standing conflict (no active rebase) -> Needs you, actionable "resolve it" card', () => {
  const l = lanesFrom([pr({ needsRebase: true })]);
  assert.deepEqual(cardIds(l.needs), ['site-vdp-remix#1']);
  assert.equal(cardIds(l.progress).length, 0);
  const branch = itemsFor(l.needs, 'site-vdp-remix#1').find((i) => i.kind === 'branch');
  assert.equal(branch.branch.kind, 'surfaced');                 // actionable, not a fake rebasing pulse
  assert.match(branch.branch.detail, /Merge conflict/);
});

test('a conflict WITH a rebase worker in flight -> In progress, "rebasing now" card', () => {
  const key = 'site-vdp-remix#1';
  const l = lanesFrom([pr({ needsRebase: true })], { isRebasing: (prId) => prId === key });
  assert.deepEqual(cardIds(l.progress), [key]);
  assert.equal(cardIds(l.needs).length, 0);
  assert.equal(itemsFor(l.progress, key).find((i) => i.kind === 'branch').branch.kind, 'conflict');
});

test('overlay: a dispatched approval moves the thread Needs-you -> In progress (as pending)', () => {
  const key = 'site-vdp-remix#1';
  const l = lanesFrom([pr({ threads: [{ id: 'a', disposition: 'needsYourApproval' }] })], {
    isDispatched: (prId, tId) => prId === key && tId === 'a',
  });
  assert.equal(cardIds(l.needs).length, 0);
  assert.deepEqual(cardIds(l.progress), [key]);
  const thread = itemsFor(l.progress, key).find((i) => i.kind === 'thread').thread;
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

test('cards within a lane are ordered by urgency (surfaced/approval before error)', () => {
  const a = pr({ number: 1, threads: [{ id: 'a', disposition: 'needsYourApproval' }] }); // rank 0
  const b = pr({ number: 2, threads: [{ id: 'b', disposition: 'agentError' }] });        // rank 1
  const l = lanesFrom([b, a]); // intentionally out of order
  assert.deepEqual(cardIds(l.needs), ['site-vdp-remix#1', 'site-vdp-remix#2']);
});
