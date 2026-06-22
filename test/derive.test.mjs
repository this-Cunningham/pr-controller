// Locks the canonical-record builder (derive.mjs) — the exact production derivation
// from a scanned PR + the worker's stored verdict into the dashboard-rendered shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveRecord } from '../derive.mjs';
import { config } from '../config.mjs';

function scannedPr(over = {}) {
  return {
    repo: 'r', number: 1, title: over.title ?? 'Test PR',
    branchHealth: over.branchHealth ?? { mergeable: 'MERGEABLE', mergeState: 'CLEAN', failingChecks: [], complianceChecks: [] },
    threads: over.threads ?? [],
  };
}

test('deriveRecord: no worker verdict -> disposition by who-spoke-last', () => {
  const pr = deriveRecord(scannedPr({ threads: [
    { threadId: 'a', lastAuthor: 'reviewer' },
    { threadId: 'b', lastAuthor: config.login },   // the configured user spoke last
  ] }), { workerResult: null });
  assert.equal(pr.threads[0].disposition, 'notYetReviewed');   // reviewer spoke last
  assert.equal(pr.threads[1].disposition, 'awaitingReviewer'); // I spoke last
});

test('deriveRecord: a worker fix/surface verdict drives disposition + carries the aids', () => {
  const pr = deriveRecord(scannedPr({ threads: [
    { threadId: 'a', lastAuthor: 'reviewer' },
    { threadId: 'b', lastAuthor: 'reviewer' },
  ] }), { workerResult: { actions: [
    { threadId: 'a', response: 'surface', reason: 'risky', suggestedReply: 'PTAL', suggestedApproach: 'extract a helper' },
    { threadId: 'b', response: 'fix', reason: 'mechanical' },
  ] } });
  assert.equal(pr.threads[0].disposition, 'needsYourApproval');
  assert.equal(pr.threads[0].suggestedReply, 'PTAL');
  assert.equal(pr.threads[0].suggestedApproach, 'extract a helper');
  assert.equal(pr.threads[1].disposition, 'agentAutoFixed');
});

test('deriveRecord: needsRebase + behindBase derived from branch health', () => {
  const pr = deriveRecord(scannedPr({ branchHealth: { mergeable: 'CONFLICTING', mergeState: 'DIRTY', failingChecks: [], complianceChecks: [] } }));
  assert.equal(pr.needsRebase, true);
  assert.equal(pr.behindBase, true);
});

test('deriveRecord: needsJira when compliance fails and the title has no ticket', () => {
  const pr = deriveRecord(scannedPr({ title: 'no ticket here', branchHealth: { failingChecks: [], complianceChecks: [{ name: 'compliance/sox' }] } }));
  assert.equal(pr.needsJira, true);
});

test('deriveRecord: surfaced honored only while the branch still conflicts (stale-safe)', () => {
  const conflicting = { mergeable: 'CONFLICTING', mergeState: 'DIRTY', failingChecks: [], complianceChecks: [] };
  const clean = { mergeable: 'MERGEABLE', mergeState: 'CLEAN', failingChecks: [], complianceChecks: [] };
  const wr = { branchHealth: { surfaced: 'rebase too risky' } };
  assert.equal(deriveRecord(scannedPr({ branchHealth: conflicting }), { workerResult: wr }).workerSurfaced, 'rebase too risky');
  assert.equal(deriveRecord(scannedPr({ branchHealth: clean }), { workerResult: wr }).workerSurfaced, undefined);
});

test('deriveRecord: outOfSync flows through from the dispatcher flag', () => {
  assert.equal(deriveRecord(scannedPr({}), { outOfSync: true }).outOfSync, true);
  assert.equal(deriveRecord(scannedPr({}), { outOfSync: false }).outOfSync, false);
});

test('deriveRecord: readyToMerge follows GitHub mergeState === CLEAN (PR-level badge)', () => {
  const bh = (mergeState) => ({ mergeable: 'MERGEABLE', mergeState, failingChecks: [], complianceChecks: [] });
  assert.equal(deriveRecord(scannedPr({ branchHealth: bh('CLEAN') })).readyToMerge, true);
  assert.equal(deriveRecord(scannedPr({ branchHealth: bh('BLOCKED') })).readyToMerge, false); // required reviews/checks not met
  assert.equal(deriveRecord(scannedPr({ branchHealth: bh('BEHIND') })).readyToMerge, false);  // behind base is its own state
  assert.equal(deriveRecord(scannedPr({ branchHealth: bh('DIRTY') })).readyToMerge, false);   // conflict
});
