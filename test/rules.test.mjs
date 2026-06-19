// Locks the deterministic behavior of pr-controller. Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dispatchable, categorizeChecks, needsJira, rebaseAllowed, needsRebase, repoSlug, inScope, deriveTier,
  validateWorkerResult, mergePending, dispatchDecision, applyDebugReviewer, DEBUG_REVIEWER,
} from '../rules.mjs';
import { config } from '../config.mjs';

const ME = 'ccunningham';
const TOKEN = '@claude-plz-fix';

test('dispatchable: reviewer had the last word -> dispatch', () => {
  assert.equal(dispatchable({ lastAuthor: 'jheipler', lastBody: 'please fix' }, ME, TOKEN), true);
});

test('dispatchable: my plain annotation -> no dispatch', () => {
  assert.equal(dispatchable({ lastAuthor: ME, lastBody: 'note for future reviewers' }, ME, TOKEN), false);
});

test('dispatchable: my reply (waiting on reviewer) -> no dispatch', () => {
  assert.equal(dispatchable({ lastAuthor: ME, lastBody: 'done, ptal' }, ME, TOKEN), false);
});

test('dispatchable: my comment WITH trigger token -> dispatch', () => {
  assert.equal(dispatchable({ lastAuthor: ME, lastBody: 'this is gross @claude-plz-fix' }, ME, TOKEN), true);
});

test('dispatchable: reviewer replies on MY thread -> dispatch (keys on last author)', () => {
  assert.equal(dispatchable({ lastAuthor: 'jheipler', lastBody: 'actually, change this' }, ME, TOKEN), true);
});

test('dispatchable: after bot replies "fixed" as me -> no re-dispatch', () => {
  assert.equal(dispatchable({ lastAuthor: ME, lastBody: 'fixed' }, ME, TOKEN), false);
});

// TEMP (debug): @claude-debug opts in my own comment, same as the trigger token.
// config.login is the real login, so this test uses that rather than ME.
test('dispatchable: my comment WITH @claude-debug -> dispatch', () => {
  assert.equal(dispatchable({ lastAuthor: config.login, lastBody: 'seed this @claude-debug' }), true);
});

const ME2 = 'ccunningham';

test('deriveTier: worker surfaced -> needsYourApproval with the code-cited reason', () => {
  const r = deriveTier({ lastAuthor: 'jheipler' }, { response: 'surface', reason: 'breaks the guard' }, ME2);
  assert.equal(r.tier, 'needsYourApproval');
  assert.equal(r.reason, 'breaks the guard');
});

test('deriveTier: worker fixed -> agentAutoFixed (Phase B: split from praise)', () => {
  const r = deriveTier({ lastAuthor: ME2 }, { response: 'fix', reason: 'fixed it' }, ME2);
  assert.equal(r.tier, 'agentAutoFixed');
});

test('deriveTier: worker praised -> agentAcknowledged (Phase B: distinct from fix)', () => {
  assert.equal(deriveTier({ lastAuthor: ME2 }, { response: 'praise' }, ME2).tier, 'agentAcknowledged');
});

test('deriveTier: no worker action, reviewer last word -> notYetReviewed', () => {
  assert.equal(deriveTier({ lastAuthor: 'jheipler' }, undefined, ME2).tier, 'notYetReviewed');
});

test('deriveTier: no worker action, I replied last -> awaitingReviewer', () => {
  assert.equal(deriveTier({ lastAuthor: ME2 }, undefined, ME2).tier, 'awaitingReviewer');
});

test('deriveTier: thread error -> agentError', () => {
  assert.equal(deriveTier({ error: 'scan failed' }, undefined, ME2).tier, 'agentError');
});

test('validateWorkerResult: valid result passes with no problems', () => {
  const raw = { prKey: 'r#1', actions: [
    { threadId: 'a', response: 'fix', resolved: true },
    { threadId: 'b', response: 'surface', reason: 'risky' },
  ], branchHealth: { surfaced: 'rebase needed' } };
  const { result, problems } = validateWorkerResult(raw);
  assert.equal(problems.length, 0);
  assert.equal(result.actions.length, 2);
});

test('validateWorkerResult: drops malformed actions, keeps the good ones', () => {
  const raw = { actions: [
    { threadId: 'a', response: 'fix' },
    { threadId: 'b', response: 'disposition-renamed' }, // bad response
    { response: 'surface' },                            // missing threadId
  ] };
  const { result, problems } = validateWorkerResult(raw);
  assert.deepEqual(result.actions.map((a) => a.threadId), ['a']);
  assert.equal(problems.length, 2);
});

test('validateWorkerResult: non-object payload -> null result', () => {
  assert.equal(validateWorkerResult(null).result, null);
  assert.equal(validateWorkerResult('a string').result, null);
  assert.equal(validateWorkerResult([1, 2]).result, null);
});

test('validateWorkerResult: actions present but not an array -> null result', () => {
  const { result, problems } = validateWorkerResult({ actions: 'nope' });
  assert.equal(result, null);
  assert.ok(problems[0].includes('actions'));
});

test('validateWorkerResult: missing actions is fine (branch-health-only run)', () => {
  const { result, problems } = validateWorkerResult({ branchHealth: { surfaced: 'x' } });
  assert.deepEqual(result.actions, []);
  assert.equal(problems.length, 0);
});

test('validateWorkerResult: preserves suggestedReply/suggestedApproach on a surface action', () => {
  const raw = { actions: [
    { threadId: 'a', response: 'surface', reason: 'risky',
      suggestedReply: 'I think the guard is intentional because…',
      suggestedApproach: 'Extract a helper and add a test' },
  ] };
  const { result, problems } = validateWorkerResult(raw);
  assert.equal(problems.length, 0);
  assert.equal(result.actions[0].suggestedReply, 'I think the guard is intentional because…');
  assert.equal(result.actions[0].suggestedApproach, 'Extract a helper and add a test');
});

test('mergePending: dedupes by threadId, skips errored / id-less threads', () => {
  const m = new Map();
  mergePending(m, [{ threadId: 'a', body: 'v1' }, { threadId: 'b' }]);
  mergePending(m, [{ threadId: 'a', body: 'v2' }, { error: 'scan failed' }, { body: 'no id' }]);
  assert.deepEqual([...m.keys()], ['a', 'b']);
  assert.equal(m.get('a').body, 'v2'); // latest wins
});

const cfg = {
  ignoreChecks: ['license/', 'cla', 'dco'],
  complianceChecks: ['compliance/sox', 'compliance/'],
  jiraPattern: '[A-Z]{2,}-\\d+',
};

test('categorizeChecks: splits code / compliance, drops ignored', () => {
  const failed = [
    { name: 'pr-test/typecheck', state: 'FAILURE' },
    { name: 'compliance/sox', state: 'FAILURE' },
    { name: 'license/cla', state: 'FAILURE' },
  ];
  const { codeChecks, complianceChecks } = categorizeChecks(failed, cfg);
  assert.deepEqual(codeChecks.map(c => c.name), ['pr-test/typecheck']);
  assert.deepEqual(complianceChecks.map(c => c.name), ['compliance/sox']);
});

test('categorizeChecks: empty input -> empty buckets', () => {
  const { codeChecks, complianceChecks } = categorizeChecks([], cfg);
  assert.equal(codeChecks.length, 0);
  assert.equal(complianceChecks.length, 0);
});

test('needsJira: compliance failing + no ticket in title -> true', () => {
  assert.equal(needsJira('Migrate agent-router to single-agent', [{ name: 'compliance/sox' }], cfg.jiraPattern), true);
});

test('needsJira: compliance failing + ticket present -> false', () => {
  assert.equal(needsJira('[CNAI-277] chip copy', [{ name: 'compliance/sox' }], cfg.jiraPattern), false);
});

test('needsJira: no compliance failure -> false even without ticket', () => {
  assert.equal(needsJira('no ticket here', [], cfg.jiraPattern), false);
});

test('rebaseAllowed: only when APPROVED and behind/conflicted', () => {
  assert.equal(rebaseAllowed('APPROVED', 'BEHIND', 'MERGEABLE'), true);
  assert.equal(rebaseAllowed('APPROVED', 'CLEAN', 'MERGEABLE'), false);
  assert.equal(rebaseAllowed('REVIEW_REQUIRED', 'BEHIND', 'MERGEABLE'), false);
  assert.equal(rebaseAllowed('APPROVED', 'DIRTY', 'CONFLICTING'), true);
});

test('needsRebase: true only on a genuine conflict, not merely behind base', () => {
  assert.equal(needsRebase('DIRTY', 'CONFLICTING'), true);
  assert.equal(needsRebase('CLEAN', 'CONFLICTING'), true);  // conflict signalled via mergeable
  assert.equal(needsRebase('DIRTY', 'UNKNOWN'), true);
  assert.equal(needsRebase('BEHIND', 'MERGEABLE'), false);  // behind base, no conflict -> no CTA
  assert.equal(needsRebase('CLEAN', 'MERGEABLE'), false);
});

const DBG = '@claude-debug';

test('applyDebugReviewer: my comment with the token -> re-attributed to a reviewer', () => {
  const t = applyDebugReviewer(
    { author: 'someone', lastAuthor: ME, lastBody: `surface this @claude-debug` }, ME, DBG);
  assert.equal(t.lastAuthor, DEBUG_REVIEWER);
  // dispatchable now sees a reviewer last word, and deriveTier (no verdict) -> notYetReviewed
  assert.equal(dispatchable(t, ME), true);
  assert.equal(deriveTier(t, undefined, ME).tier, 'notYetReviewed');
});

test('applyDebugReviewer: also rewrites author when I opened the thread too', () => {
  const t = applyDebugReviewer(
    { author: ME, lastAuthor: ME, lastBody: `@claude-debug` }, ME, DBG);
  assert.equal(t.author, DEBUG_REVIEWER);
  assert.equal(t.lastAuthor, DEBUG_REVIEWER);
});

test('applyDebugReviewer: my comment WITHOUT the token -> untouched', () => {
  const t = applyDebugReviewer({ author: ME, lastAuthor: ME, lastBody: 'plain note' }, ME, DBG);
  assert.equal(t.lastAuthor, ME);
});

test('applyDebugReviewer: a real reviewer comment -> untouched', () => {
  const t = applyDebugReviewer({ author: 'jheipler', lastAuthor: 'jheipler', lastBody: 'fix @claude-debug' }, ME, DBG);
  assert.equal(t.lastAuthor, 'jheipler');
});

test('applyDebugReviewer: disabled (no token configured) -> untouched', () => {
  const t = applyDebugReviewer({ author: ME, lastAuthor: ME, lastBody: '@claude-debug' }, ME, '');
  assert.equal(t.lastAuthor, ME);
});

test('applyDebugReviewer: errored thread -> untouched', () => {
  const t = applyDebugReviewer({ error: 'scan failed' }, ME, DBG);
  assert.deepEqual(t, { error: 'scan failed' });
});

test('dispatchDecision: new threads -> feedback run (no conflict to fold)', () => {
  const d = dispatchDecision({ newThreadCount: 2, healthChanged: false });
  assert.equal(d.kind, 'feedback');
  assert.equal(d.rebaseOnConflict, false);
});

test('dispatchDecision: new threads + conflict -> feedback run folds the rebase', () => {
  const d = dispatchDecision({ newThreadCount: 1, needsRebase: true, healthChanged: true });
  assert.equal(d.kind, 'feedback');
  assert.equal(d.rebaseOnConflict, true);
});

test('dispatchDecision: failing CI that already existed (no change) -> none', () => {
  // ciFailing is work, but nothing CHANGED this poll, so we don't re-spin.
  assert.equal(dispatchDecision({ ciFailing: true, healthChanged: false }).kind, 'none');
});

test('dispatchDecision: failing CI newly appeared (health changed) -> feedback', () => {
  assert.equal(dispatchDecision({ ciFailing: true, healthChanged: true }).kind, 'feedback');
});

test('dispatchDecision: Phase E — idle conflict + health changed -> rebase', () => {
  const d = dispatchDecision({ newThreadCount: 0, ciFailing: false, needsRebase: true, healthChanged: true });
  assert.equal(d.kind, 'rebase');
});

test('dispatchDecision: Phase E — standing idle conflict (health unchanged) -> none (no re-spin loop)', () => {
  assert.equal(dispatchDecision({ needsRebase: true, healthChanged: false }).kind, 'none');
});

test('dispatchDecision: nothing actionable -> none', () => {
  assert.equal(dispatchDecision({}).kind, 'none');
});

test('inScope: empty/null allowlist -> all PRs in scope', () => {
  assert.equal(inScope('site-vdp-remix#835', []), true);
  assert.equal(inScope('site-vdp-remix#835', null), true);
  assert.equal(inScope('any-repo#1', []), true);
});

test('inScope: non-empty allowlist restricts to listed PR keys', () => {
  const only = ['site-vdp-remix#835'];
  assert.equal(inScope('site-vdp-remix#835', only), true);
  assert.equal(inScope('site-vdp-remix#999', only), false);
  assert.equal(inScope('other-repo#835', only), false);
});

test('repoSlug: handles ssh and https, with/without .git', () => {
  assert.equal(repoSlug('git@code.cargurus.com:cargurus-eng/universal-ai.git'), 'cargurus-eng/universal-ai');
  assert.equal(repoSlug('https://code.cargurus.com/cargurus-eng/chassis.git'), 'cargurus-eng/chassis');
  assert.equal(repoSlug('https://code.cargurus.com/cargurus-eng/site-vdp-remix'), 'cargurus-eng/site-vdp-remix');
  assert.equal(repoSlug(''), null);
});
