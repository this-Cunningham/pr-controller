// Locks per-item tab routing in the dashboard adapter against the vendored v2
// design system. adapt.js is pure (no React), so it imports under node --test.
// adaptSections lists the FULL DS PRs that have ≥1 item in a tab; the DS PRCard
// then renders only that tab's slice. We assert membership here, and slice
// membership via the exported TAG_TAB/BRANCH_TAB + prInTab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptSections, adaptPR, prInTab, TAG_TAB, BRANCH_TAB } from '../pr-controller-react/src/adapt.js';

// Build a backend-shape PR. `threads` take { id, tier } (+ optional lastAuthor).
function pr(over = {}) {
  return {
    number: over.number ?? 1,
    repo: over.repo ?? 'site-vdp-remix',
    title: over.title ?? 'Test PR',
    url: 'http://x',
    isDraft: false,
    reviewDecision: over.reviewDecision ?? 'REVIEW_REQUIRED',
    needsJira: over.needsJira ?? false,
    behindBase: over.behindBase ?? false,
    ciFailing: over.ciFailing ?? false,
    needsRebase: over.needsRebase ?? false,
    outOfSync: over.outOfSync ?? false,
    workerSurfaced: over.workerSurfaced ?? null,
    branchHealth: over.branchHealth ?? { failingChecks: [], complianceChecks: [] },
    threads: (over.threads || []).map((t, i) => ({
      threadId: t.id ?? `t${i}`,
      path: 'a.js', line: 1,
      author: 'reviewer', lastAuthor: t.lastAuthor ?? 'reviewer',
      body: 'x', tier: t.tier, reason: 'r',
      suggestedApproach: t.suggestedApproach, suggestedReply: t.suggestedReply,
    })),
  };
}

const sectionsOf = (prs, overlays) => {
  const s = adaptSections(prs, overlays);
  return Object.fromEntries(s.map((x) => [x.key, x]));
};
const ids = (section) => section.prs.map((p) => p.id);
// Which DS thread ids would render in `tabKey` for this PR (mirrors the DS PRCard's
// internal filter: threads whose TAG_TAB maps to the tab).
const sliceThreadIds = (uiPr, tabKey) =>
  (uiPr.threads || []).filter((t) => TAG_TAB[t.tag] === tabKey).map((t) => t.id);

test('section keys/titles: needs / progress / waiting (v2 "In progress")', () => {
  const s = adaptSections([], {});
  assert.deepEqual(s.map((x) => x.key), ['needs', 'progress', 'waiting']);
  assert.deepEqual(s.map((x) => x.title), ['Needs you', 'In progress', 'Waiting on reviewer']);
});

test('adaptPR emits DS short tags', () => {
  const ui = adaptPR(pr({ threads: [
    { id: 'a', tier: 'needsYourApproval' }, { id: 'b', tier: 'agentAutoFixed' },
    { id: 'c', tier: 'notYetReviewed' }, { id: 'd', tier: 'agentAcknowledged' },
    { id: 'e', tier: 'agentError' }, { id: 'f', tier: 'awaitingReviewer' },
  ] }));
  assert.deepEqual(ui.threads.map((t) => t.tag), ['input', 'fixed', 'pending', 'praise', 'error', 'waiting']);
});

test('needsYourApproval (input) -> Needs you', () => {
  const s = sectionsOf([pr({ threads: [{ id: 'a', tier: 'needsYourApproval' }] })]);
  assert.deepEqual(ids(s.needs), ['site-vdp-remix#1']);
  assert.deepEqual(ids(s.progress), []);
  assert.deepEqual(ids(s.waiting), []);
});

test('notYetReviewed (pending) -> In progress', () => {
  const s = sectionsOf([pr({ threads: [{ id: 'a', tier: 'notYetReviewed' }] })]);
  assert.deepEqual(ids(s.progress), ['site-vdp-remix#1']);
  assert.deepEqual(ids(s.needs), []);
});

test('agentAutoFixed (fixed) -> Waiting', () => {
  const s = sectionsOf([pr({ threads: [{ id: 'a', tier: 'agentAutoFixed' }] })]);
  assert.deepEqual(ids(s.waiting), ['site-vdp-remix#1']);
  assert.deepEqual(ids(s.progress), []);
});

test('awaitingReviewer (waiting) -> Waiting', () => {
  const s = sectionsOf([pr({ threads: [{ id: 'a', tier: 'awaitingReviewer', lastAuthor: 'ccunningham' }] })]);
  assert.deepEqual(ids(s.waiting), ['site-vdp-remix#1']);
});

test('agentAcknowledged (praise) -> shown in NO tab', () => {
  const s = sectionsOf([pr({ threads: [{ id: 'a', tier: 'agentAcknowledged' }] })]);
  assert.deepEqual(ids(s.needs), []);
  assert.deepEqual(ids(s.progress), []);
  assert.deepEqual(ids(s.waiting), []);
});

test('agentError (error) -> Needs you', () => {
  const s = sectionsOf([pr({ threads: [{ id: 'a', tier: 'agentError' }] })]);
  assert.deepEqual(ids(s.needs), ['site-vdp-remix#1']);
});

test('a mixed PR appears in all three tabs, each with the right item slice', () => {
  const p = pr({ threads: [
    { id: 'surf', tier: 'needsYourApproval' },
    { id: 'fix', tier: 'agentAutoFixed' },
    { id: 'wip', tier: 'notYetReviewed' },
  ] });
  const s = sectionsOf([p]);
  const key = 'site-vdp-remix#1';
  assert.deepEqual(ids(s.needs), [key]);
  assert.deepEqual(ids(s.progress), [key]);
  assert.deepEqual(ids(s.waiting), [key]);
  // and the DS card slice for each tab shows only that tab's threads
  const ui = s.needs.prs[0];
  assert.deepEqual(sliceThreadIds(ui, 'needs'), ['surf']);
  assert.deepEqual(sliceThreadIds(ui, 'progress'), ['wip']);
  assert.deepEqual(sliceThreadIds(ui, 'waiting'), ['fix']);
});

test('dispatched approval re-tags input->pending so it moves Needs-you -> In progress', () => {
  const p = pr({ threads: [{ id: 'a', tier: 'needsYourApproval' }] });
  const overlays = { isDispatched: (prId, tId) => prId === 'site-vdp-remix#1' && tId === 'a' };
  const s = sectionsOf([p], overlays);
  assert.deepEqual(ids(s.needs), []);
  assert.deepEqual(ids(s.progress), ['site-vdp-remix#1']);
  assert.equal(s.progress.prs[0].threads[0].tag, 'pending');
});

test('isWorking pulls a thread-less PR into In progress (worker in flight)', () => {
  const s = sectionsOf([pr({ threads: [] })], { isWorking: () => true });
  assert.deepEqual(ids(s.progress), ['site-vdp-remix#1']);
});

test('needsJira -> Needs you; CI -> In progress (branch.kind/pills)', () => {
  const jiraPr = pr({ number: 2, needsJira: true });
  const ciPr = pr({ number: 3, ciFailing: true,
    branchHealth: { failingChecks: [{ name: 'unit' }], complianceChecks: [] } });
  const s = sectionsOf([jiraPr, ciPr]);
  assert.ok(ids(s.needs).includes('site-vdp-remix#2'));
  // a CI pill alone doesn't route a PR anywhere (pills are decoration); confirm the
  // pill is present on the adapted PR though.
  const ci = adaptPR(ciPr);
  assert.ok(ci.pills.some((p) => p.kind === 'ci'));
});

test('outOfSync -> branch.kind outofsync -> Needs you', () => {
  const ui = adaptPR(pr({ outOfSync: true }));
  assert.equal(ui.branch.kind, 'outofsync');
  assert.equal(BRANCH_TAB[ui.branch.kind], 'needs');
  assert.deepEqual(ids(sectionsOf([pr({ outOfSync: true })]).needs), ['site-vdp-remix#1']);
});

test('workerSurfaced -> branch.kind surfaced (with details) -> Needs you, not In progress', () => {
  const ui = adaptPR(pr({ workerSurfaced: 'rebase too risky', needsRebase: true }));
  assert.equal(ui.branch.kind, 'surfaced');           // surfaced wins over raw conflict
  assert.equal(ui.branch.details, 'rebase too risky');
  const s = sectionsOf([pr({ workerSurfaced: 'rebase too risky', needsRebase: true })]);
  assert.deepEqual(ids(s.needs), ['site-vdp-remix#1']);
  assert.deepEqual(ids(s.progress), []);
});

test('a plain merge conflict -> branch.kind conflict -> In progress (agent rebasing)', () => {
  const ui = adaptPR(pr({ needsRebase: true }));
  assert.equal(ui.branch.kind, 'conflict');
  assert.equal(BRANCH_TAB[ui.branch.kind], 'progress');
  assert.deepEqual(ids(sectionsOf([pr({ needsRebase: true })]).progress), ['site-vdp-remix#1']);
});

test('prInTab matches section membership', () => {
  const p = adaptPR(pr({ threads: [{ id: 'a', tier: 'needsYourApproval' }] }));
  assert.equal(prInTab(p, 'needs'), true);
  assert.equal(prInTab(p, 'waiting'), false);
});
