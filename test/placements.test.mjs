// Locks the server-authoritative tab routing. placements.mjs is the single source of
// truth for which lane each item belongs to (placementsFor, LANE_OF_DISPOSITION,
// prSortRank); the daemon emits these placement rows and the frontend renders them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placementsFor, prSortRank, laneOf, LANE_OF_DISPOSITION } from '../placements.mjs';

// Build a derived-PR-shape record. `threads` take { id, disposition, reason, error }.
function pr(over = {}) {
  return {
    repo: over.repo ?? 'site-vdp-remix',
    number: over.number ?? 1,
    needsJira: over.needsJira ?? false,
    workerSurfaced: over.workerSurfaced ?? null,
    outOfSync: over.outOfSync ?? false,
    needsRebase: over.needsRebase ?? false,
    workerError: over.workerError ?? null,
    liveStatus: over.liveStatus ?? 'idle',
    threads: (over.threads || []).map((t, i) => ({
      threadId: t.id ?? `t${i}`, disposition: t.disposition, reason: t.reason ?? 'r', error: t.error,
    })),
  };
}

// Rows for one PR, indexed by lane.
const lanesOf = (record) => {
  const rows = placementsFor(record);
  return {
    rows,
    needs: rows.filter((r) => r.lane === 'needs'),
    progress: rows.filter((r) => r.lane === 'progress'),
    waiting: rows.filter((r) => r.lane === 'waiting'),
  };
};
const subjects = (rows) => rows.map((r) => r.subjectId);

test('LANE_OF_DISPOSITION is total for the thread vocabulary; praise routes nowhere', () => {
  assert.equal(LANE_OF_DISPOSITION.needsYourApproval, 'needs');
  assert.equal(LANE_OF_DISPOSITION.agentError, 'needs');
  assert.equal(LANE_OF_DISPOSITION.notYetReviewed, 'progress');
  assert.equal(LANE_OF_DISPOSITION.agentAutoFixed, 'waiting');
  assert.equal(LANE_OF_DISPOSITION.awaitingReviewer, 'waiting');
  assert.equal(LANE_OF_DISPOSITION.agentAcknowledged, null);
  assert.equal(LANE_OF_DISPOSITION.workerFailed, 'needs');
});

test('needsYourApproval (input) -> Needs you', () => {
  const l = lanesOf(pr({ threads: [{ id: 'a', disposition: 'needsYourApproval' }] }));
  assert.deepEqual(subjects(l.needs), ['a']);
  assert.equal(l.progress.length, 0);
  assert.equal(l.waiting.length, 0);
});

test('notYetReviewed (pending) -> In progress', () => {
  const l = lanesOf(pr({ threads: [{ id: 'a', disposition: 'notYetReviewed' }] }));
  assert.deepEqual(subjects(l.progress), ['a']);
  assert.equal(l.needs.length, 0);
});

test('agentAutoFixed (fixed) -> Waiting', () => {
  const l = lanesOf(pr({ threads: [{ id: 'a', disposition: 'agentAutoFixed' }] }));
  assert.deepEqual(subjects(l.waiting), ['a']);
  assert.equal(l.progress.length, 0);
});

test('awaitingReviewer -> Waiting', () => {
  const l = lanesOf(pr({ threads: [{ id: 'a', disposition: 'awaitingReviewer' }] }));
  assert.deepEqual(subjects(l.waiting), ['a']);
});

test('agentAcknowledged (praise) -> NO row in any lane', () => {
  const l = lanesOf(pr({ threads: [{ id: 'a', disposition: 'agentAcknowledged' }] }));
  assert.equal(l.rows.length, 0);
});

test('agentError -> Needs you', () => {
  const l = lanesOf(pr({ threads: [{ id: 'a', disposition: 'agentError' }] }));
  assert.deepEqual(subjects(l.needs), ['a']);
});

test('an errored thread (scan failure) escalates to Needs you', () => {
  const l = lanesOf(pr({ threads: [{ id: 'bad', error: 'scan failed' }] }));
  assert.deepEqual(subjects(l.needs), ['bad']);
  assert.equal(l.needs[0].disposition, 'agentError');
});

test('a mixed PR emits one row per lane — appears in all three tabs', () => {
  const l = lanesOf(pr({ threads: [
    { id: 'surf', disposition: 'needsYourApproval' },
    { id: 'fix', disposition: 'agentAutoFixed' },
    { id: 'wip', disposition: 'notYetReviewed' },
  ] }));
  assert.deepEqual(subjects(l.needs), ['surf']);
  assert.deepEqual(subjects(l.progress), ['wip']);
  assert.deepEqual(subjects(l.waiting), ['fix']);
  // every row carries the grouping parent
  assert.ok(l.rows.every((r) => r.prKey === 'site-vdp-remix#1'));
});

test('needsJira -> a Needs-you jira row', () => {
  const l = lanesOf(pr({ needsJira: true }));
  assert.deepEqual(subjects(l.needs), ['jira']);
  assert.equal(l.needs[0].subjectKind, 'jira');
});

test('outOfSync -> a Needs-you branch row', () => {
  const l = lanesOf(pr({ outOfSync: true }));
  assert.equal(l.needs.length, 1);
  assert.equal(l.needs[0].disposition, 'branchOutOfSync');
});

test('a failed worker run -> a Needs-you workerFailed row carrying the reason', () => {
  const l = lanesOf(pr({ workerError: 'Git SSH auth failed (Permission denied, publickey).' }));
  assert.equal(l.needs.length, 1);
  assert.equal(l.needs[0].disposition, 'workerFailed');
  assert.equal(l.needs[0].reason, 'Git SSH auth failed (Permission denied, publickey).');
  assert.equal(l.progress.length, 0);
});

test('a surfaced rebase -> one Needs-you conflict row carrying the agent reason', () => {
  const l = lanesOf(pr({ workerSurfaced: 'rebase too risky', needsRebase: true }));
  assert.equal(l.needs.length, 1);
  assert.equal(l.needs[0].disposition, 'branchConflict'); // folded into the one conflict state
  assert.equal(l.needs[0].reason, 'rebase too risky');    // the explanation rides on the conflict row
  assert.equal(l.progress.length, 0);
});

test('a standing merge conflict -> Needs you (your turn), NOT a perpetual In-progress', () => {
  const l = lanesOf(pr({ needsRebase: true }));
  assert.deepEqual(l.needs.map((r) => r.disposition), ['branchConflict']);
  assert.equal(l.progress.length, 0);
});

test('liveStatus working with no threads -> a synthetic In-progress row', () => {
  const l = lanesOf(pr({ threads: [], liveStatus: 'working' }));
  assert.deepEqual(l.progress.map((r) => r.disposition), ['agentWorking']);
});

test('liveStatus working does NOT duplicate an existing progress row', () => {
  const l = lanesOf(pr({ threads: [{ id: 'wip', disposition: 'notYetReviewed' }], liveStatus: 'working' }));
  assert.deepEqual(subjects(l.progress), ['wip']); // no extra 'live' row
});

test('unknown disposition routes to Needs you (visible), not nowhere', () => {
  assert.equal(laneOf('someRenamedDisposition'), 'needs');
});

test('prSortRank = most urgent placement; a needs-you PR outranks a waiting-only PR', () => {
  const urgent = placementsFor(pr({ number: 1, threads: [{ id: 'a', disposition: 'needsYourApproval' }, { id: 'b', disposition: 'agentAutoFixed' }] }));
  const calm = placementsFor(pr({ number: 2, threads: [{ id: 'c', disposition: 'agentAutoFixed' }] }));
  assert.equal(prSortRank(urgent), 0); // min(needsYourApproval=0, agentAutoFixed=3)
  assert.equal(prSortRank(calm), 3);
  assert.ok(prSortRank(urgent) < prSortRank(calm));
});

test('a PR with no actionable items -> no rows, sorts last', () => {
  const rows = placementsFor(pr({ threads: [{ id: 'a', disposition: 'agentAcknowledged' }] }));
  assert.equal(rows.length, 0);
  assert.equal(prSortRank(rows), 9);
});
