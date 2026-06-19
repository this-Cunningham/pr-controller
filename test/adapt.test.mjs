// Locks the per-item tab routing in the dashboard adapter (Phase C). adapt.js is
// pure (no React), so it imports directly under node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptSections } from '../pr-controller-react/src/adapt.js';

// Build a backend-shape PR. `threads` take { id, tier } (+ optional lastAuthor);
// branch-health fields default to clean.
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
    autoFixable: over.autoFixable ?? 0,
    pending: over.pending ?? 0,
    workerSurfaced: over.workerSurfaced ?? null,
    branchHealth: over.branchHealth ?? { failingChecks: [], complianceChecks: [] },
    threads: (over.threads || []).map((t, i) => ({
      threadId: t.id ?? `t${i}`,
      path: 'a.js', line: 1,
      author: 'reviewer', lastAuthor: t.lastAuthor ?? 'reviewer',
      body: 'x', tier: t.tier, reason: 'r',
    })),
  };
}

const sectionsOf = (prs, overlays) => {
  const s = adaptSections(prs, overlays);
  const byKey = Object.fromEntries(s.map((x) => [x.key, x]));
  return byKey;
};
const ids = (section) => section.prs.map((p) => p.id);
const threadIds = (section, prId) =>
  section.prs.find((p) => p.id === prId)?.threads.map((t) => t.id) ?? [];

test('section keys/titles: needs / In progress / Waiting', () => {
  const s = adaptSections([], {});
  assert.deepEqual(s.map((x) => x.key), ['needs', 'auto', 'waiting']);
  assert.deepEqual(s.map((x) => x.title), ['Needs you', 'In progress', 'Waiting on reviewer']);
});

test('needsYourApproval thread -> Needs you', () => {
  const s = sectionsOf([pr({ threads: [{ id: 'a', tier: 'needsYourApproval' }] })]);
  assert.deepEqual(ids(s.needs), ['site-vdp-remix#1']);
  assert.deepEqual(ids(s.auto), []);
  assert.deepEqual(ids(s.waiting), []);
});

test('notYetReviewed thread -> In progress', () => {
  const s = sectionsOf([pr({ threads: [{ id: 'a', tier: 'notYetReviewed' }] })]);
  assert.deepEqual(ids(s.auto), ['site-vdp-remix#1']);
  assert.deepEqual(ids(s.needs), []);
});

test('agentAutoFixed thread -> Waiting (now a stable visible state)', () => {
  const s = sectionsOf([pr({ threads: [{ id: 'a', tier: 'agentAutoFixed' }] })]);
  assert.deepEqual(ids(s.waiting), ['site-vdp-remix#1']);
  assert.deepEqual(ids(s.auto), []);
});

test('awaitingReviewer thread -> Waiting', () => {
  const s = sectionsOf([pr({ threads: [{ id: 'a', tier: 'awaitingReviewer', lastAuthor: 'ccunningham' }] })]);
  assert.deepEqual(ids(s.waiting), ['site-vdp-remix#1']);
});

test('agentAcknowledged (praise) thread -> shown in NO tab', () => {
  const s = sectionsOf([pr({ threads: [{ id: 'a', tier: 'agentAcknowledged' }] })]);
  assert.deepEqual(ids(s.needs), []);
  assert.deepEqual(ids(s.auto), []);
  assert.deepEqual(ids(s.waiting), []);
});

test('agentError thread -> Needs you', () => {
  const s = sectionsOf([pr({ threads: [{ id: 'a', tier: 'agentError' }] })]);
  assert.deepEqual(ids(s.needs), ['site-vdp-remix#1']);
});

test('a mixed PR appears in BOTH tabs, each with the right item slice', () => {
  const p = pr({ threads: [
    { id: 'surf', tier: 'needsYourApproval' },
    { id: 'fix', tier: 'agentAutoFixed' },
    { id: 'wip', tier: 'notYetReviewed' },
  ] });
  const s = sectionsOf([p]);
  assert.deepEqual(threadIds(s.needs, 'site-vdp-remix#1'), ['surf']);
  assert.deepEqual(threadIds(s.auto, 'site-vdp-remix#1'), ['wip']);
  assert.deepEqual(threadIds(s.waiting, 'site-vdp-remix#1'), ['fix']);
});

test('dispatched approval moves a needsYourApproval thread Needs-you -> In progress', () => {
  const p = pr({ threads: [{ id: 'a', tier: 'needsYourApproval' }] });
  const overlays = { isDispatched: (prId, tId) => prId === 'site-vdp-remix#1' && tId === 'a' };
  const s = sectionsOf([p], overlays);
  assert.deepEqual(ids(s.needs), []);
  assert.deepEqual(threadIds(s.auto, 'site-vdp-remix#1'), ['a']);
});

test('isWorking pulls a thread-less PR into In progress (worker in flight)', () => {
  const s = sectionsOf([pr({ threads: [] })], { isWorking: () => true });
  assert.deepEqual(ids(s.auto), ['site-vdp-remix#1']);
});

test('needsJira health -> Needs you; CI/behind health -> In progress', () => {
  const jiraPr = pr({ number: 2, needsJira: true,
    branchHealth: { failingChecks: [], complianceChecks: [{ name: 'compliance/sox' }] } });
  const ciPr = pr({ number: 3, ciFailing: true,
    branchHealth: { failingChecks: [{ name: 'unit' }], complianceChecks: [] } });
  const s = sectionsOf([jiraPr, ciPr]);
  assert.deepEqual(ids(s.needs), ['site-vdp-remix#2']);
  assert.deepEqual(ids(s.auto), ['site-vdp-remix#3']);
});

test('outOfSync health -> Needs you', () => {
  const s = sectionsOf([pr({ outOfSync: true })]);
  assert.deepEqual(ids(s.needs), ['site-vdp-remix#1']);
});

test('workerSurfaced branch-health -> Needs you (suppresses auto signals)', () => {
  const s = sectionsOf([pr({ workerSurfaced: 'rebase too risky', ciFailing: true,
    branchHealth: { failingChecks: [{ name: 'unit' }], complianceChecks: [] } })]);
  assert.deepEqual(ids(s.needs), ['site-vdp-remix#1']);
  assert.deepEqual(ids(s.auto), []);  // surfaced suppresses CI auto-signal
});

test('an auto-rebasing merge conflict routes the PR into In progress, keeping needsRebase', () => {
  const s = sectionsOf([pr({ needsRebase: true, branchHealth: { failingChecks: [], complianceChecks: [] } })]);
  assert.deepEqual(ids(s.auto), ['site-vdp-remix#1']);
  // the In-progress slice keeps needsRebase so the card shows "Resolving merge conflict…"
  assert.equal(s.auto.prs[0].needsRebase, true);
  // ...and is NOT duplicated into Needs you (the agent handles it; only a bail surfaces)
  assert.deepEqual(ids(s.needs), []);
});

test('a surfaced conflict -> Needs you only; In-progress slice drops needsRebase (banner owns it)', () => {
  const s = sectionsOf([pr({ needsRebase: true, workerSurfaced: 'rebase too risky',
    branchHealth: { failingChecks: [], complianceChecks: [] } })]);
  assert.deepEqual(ids(s.needs), ['site-vdp-remix#1']);
  // surfaced suppresses the needsRebase auto-signal, so it does NOT also show In progress
  assert.deepEqual(ids(s.auto), []);
  // and the Needs-you slice carries surfaced (the banner), not a redundant conflict status
  assert.equal(s.needs.prs[0].needsRebase, false);
  assert.ok(s.needs.prs[0].surfaced);
});
