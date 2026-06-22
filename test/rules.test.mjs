// Locks the deterministic behavior of pr-controller. Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dispatchable, categorizeChecks, needsJira, isBehindBase, needsRebase, repoSlug, inScope, deriveDisposition,
  validateWorkerResult, mergePending, dispatchDecision, nextSeenThreads, applyDebugReviewer, DEBUG_REVIEWER, isWorkerResultStale,
  cloneUrl, configProblems,
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

test('deriveDisposition: worker surfaced -> needsYourApproval with the code-cited reason', () => {
  const r = deriveDisposition({ lastAuthor: 'jheipler' }, { response: 'surface', reason: 'breaks the guard' }, ME2);
  assert.equal(r.disposition, 'needsYourApproval');
  assert.equal(r.reason, 'breaks the guard');
});

test('deriveDisposition: worker fixed -> agentAutoFixed (distinct from praise)', () => {
  const r = deriveDisposition({ lastAuthor: ME2 }, { response: 'fix', reason: 'fixed it' }, ME2);
  assert.equal(r.disposition, 'agentAutoFixed');
});

test('deriveDisposition: worker praised -> agentAcknowledged (distinct from fix)', () => {
  assert.equal(deriveDisposition({ lastAuthor: ME2 }, { response: 'praise' }, ME2).disposition, 'agentAcknowledged');
});

test('deriveDisposition: no worker action, reviewer last word -> notYetReviewed', () => {
  assert.equal(deriveDisposition({ lastAuthor: 'jheipler' }, undefined, ME2).disposition, 'notYetReviewed');
});

test('deriveDisposition: no worker action, I replied last -> awaitingReviewer', () => {
  assert.equal(deriveDisposition({ lastAuthor: ME2 }, undefined, ME2).disposition, 'awaitingReviewer');
});

test('deriveDisposition: thread error -> agentError', () => {
  assert.equal(deriveDisposition({ error: 'scan failed' }, undefined, ME2).disposition, 'agentError');
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

// isWorkerResultStale — the stale-verdict-file invalidation (the "PR still shows in
// auto-handling after fix + resolve" fix). A persisted file is stale once none of
// its actions match a live thread and the branch is clean.
test('isWorkerResultStale: an action still matching a live thread -> not stale', () => {
  assert.equal(isWorkerResultStale({ actions: [{ threadId: 'a', response: 'fix' }] }, new Set(['a']), {}), false);
});

test('isWorkerResultStale: no actions match a live thread + clean branch -> stale', () => {
  const result = { actions: [{ threadId: 'gone', response: 'fix' }] };
  assert.equal(isWorkerResultStale(result, new Set(['live']), {}), true);
  assert.equal(isWorkerResultStale(result, new Set(), {}), true);
});

test('isWorkerResultStale: stale actions but the branch still needs work -> NOT stale (keep the file)', () => {
  const result = { actions: [{ threadId: 'gone', response: 'fix' }] };
  assert.equal(isWorkerResultStale(result, new Set(), { needsRebase: true }), false);
  assert.equal(isWorkerResultStale(result, new Set(), { outOfSync: true }), false);
});

test('isWorkerResultStale: no actions / no result -> never stale', () => {
  assert.equal(isWorkerResultStale({ actions: [] }, new Set(), {}), false);
  assert.equal(isWorkerResultStale(null, new Set(), {}), false);
  assert.equal(isWorkerResultStale({}, new Set(), {}), false);
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

test('isBehindBase: behind OR conflicting/dirty, NOT approval-gated (the stale gate is gone)', () => {
  assert.equal(isBehindBase('BEHIND', 'MERGEABLE'), true);            // merely stale
  assert.equal(isBehindBase('DIRTY', 'CONFLICTING'), true);           // real conflict — shows regardless of approval
  assert.equal(isBehindBase('CLEAN', 'CONFLICTING'), true);           // conflict via mergeable
  assert.equal(isBehindBase('CLEAN', 'MERGEABLE'), false);            // healthy -> no pill
  assert.equal(isBehindBase('BLOCKED', 'MERGEABLE'), false);          // blocked on review, not behind
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
  // dispatchable now sees a reviewer last word, and deriveDisposition (no verdict) -> notYetReviewed
  assert.equal(dispatchable(t, ME), true);
  assert.equal(deriveDisposition(t, undefined, ME).disposition, 'notYetReviewed');
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

test('dispatchDecision: new threads, no conflict -> feedback run', () => {
  const d = dispatchDecision({ newThreadCount: 2, healthChanged: false });
  assert.equal(d.kind, 'feedback');
});

test('dispatchDecision: conflict short-circuits to rebase-ONLY, never feedback (even with new threads)', () => {
  // The whole point of the separation: a real conflict is handled by a rebase-only
  // run; threads are deferred (poll() keeps them un-seen). A bailed rebase can no
  // longer strand threads, because they were never in the run.
  const d = dispatchDecision({ newThreadCount: 3, ciFailing: true, needsRebase: true, healthChanged: true });
  assert.equal(d.kind, 'rebase');
});

test('dispatchDecision: standing conflict (health unchanged) -> none, even with new threads', () => {
  // A conflict that can't auto-resolve must not re-spin a rebase every poll, and must
  // NOT fall through to a feedback run — threads stay deferred until the branch is clean.
  assert.equal(dispatchDecision({ newThreadCount: 2, needsRebase: true, healthChanged: false }).kind, 'none');
});

test('dispatchDecision: failing CI that already existed (no change) -> none', () => {
  // ciFailing is work, but nothing CHANGED this poll, so we don't re-spin.
  assert.equal(dispatchDecision({ ciFailing: true, healthChanged: false }).kind, 'none');
});

test('dispatchDecision: failing CI newly appeared (health changed), no conflict -> feedback', () => {
  assert.equal(dispatchDecision({ ciFailing: true, healthChanged: true }).kind, 'feedback');
});

test('dispatchDecision: idle conflict + health changed -> rebase', () => {
  const d = dispatchDecision({ newThreadCount: 0, ciFailing: false, needsRebase: true, healthChanged: true });
  assert.equal(d.kind, 'rebase');
});

test('dispatchDecision: a SURFACED conflict does NOT re-rebase, even on a health change', () => {
  // the agent already flagged it too risky; re-spinning (e.g. on an unrelated CI flip)
  // would just bail again — leave it in Needs you for the user.
  assert.equal(dispatchDecision({ needsRebase: true, healthChanged: true, rebaseSurfaced: true }).kind, 'none');
  // but a conflict NOT yet surfaced still rebases on the change (the first attempt).
  assert.equal(dispatchDecision({ needsRebase: true, healthChanged: true, rebaseSurfaced: false }).kind, 'rebase');
});

test('dispatchDecision: standing idle conflict (health unchanged) -> none (no re-spin loop)', () => {
  assert.equal(dispatchDecision({ needsRebase: true, healthChanged: false }).kind, 'none');
});

test('dispatchDecision: nothing actionable -> none', () => {
  assert.equal(dispatchDecision({}).kind, 'none');
});

// nextSeenThreads — the thread-deferral half of the conflict fix. Locks that a
// conflict keeps threads "un-seen" so they dispatch once the branch is clean.
test('nextSeenThreads: no conflict -> all live threads marked seen', () => {
  const seen = nextSeenThreads(new Set(['a:1']), ['a:1', 'b:2'], false);
  assert.deepEqual([...seen].sort(), ['a:1', 'b:2']);
});

test('nextSeenThreads: conflict -> new thread is NOT marked seen (deferred)', () => {
  // prev poll had nothing seen; a new thread b:2 arrives alongside a conflict.
  // It must stay un-seen so it dispatches as feedback once the conflict clears.
  const seen = nextSeenThreads(new Set(), ['b:2'], true);
  assert.equal(seen.has('b:2'), false);
  assert.equal(seen.size, 0);
});

test('nextSeenThreads: conflict -> previously-seen threads stay seen (no re-dispatch churn)', () => {
  // a:1 was already handled before the conflict; it should remain seen so it isn't
  // re-judged, while a genuinely new b:2 stays deferred.
  const seen = nextSeenThreads(new Set(['a:1']), ['a:1', 'b:2'], true);
  assert.equal(seen.has('a:1'), true);
  assert.equal(seen.has('b:2'), false);
});

test('nextSeenThreads: conflict -> a seen thread that disappeared is dropped', () => {
  // a:1 was seen but is gone from the live set now; don't keep stale fingerprints.
  const seen = nextSeenThreads(new Set(['a:1']), ['b:2'], true);
  assert.equal(seen.has('a:1'), false);
  assert.equal(seen.size, 0);
});

test('nextSeenThreads: deferred thread becomes seen the poll after the conflict clears', () => {
  // Poll 1 (conflict): b:2 deferred. Poll 2 (clean): b:2 now marked seen.
  const duringConflict = nextSeenThreads(new Set(), ['b:2'], true);
  assert.equal(duringConflict.has('b:2'), false);
  const afterClear = nextSeenThreads(duringConflict, ['b:2'], false);
  assert.equal(afterClear.has('b:2'), true);
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

test('cloneUrl: ssh (default) vs https, configurable host — no hardcoded transport', () => {
  // ssh form (the default / prior behavior)
  assert.equal(
    cloneUrl('cargurus-eng/site-vdp-remix', { host: 'code.cargurus.com', protocol: 'ssh' }),
    'git@code.cargurus.com:cargurus-eng/site-vdp-remix.git');
  // https form (SSH-less hosts: CI / containers) — auth via a git credential helper
  assert.equal(
    cloneUrl('this-Cunningham/pr-controller', { host: 'github.com', protocol: 'https' }),
    'https://github.com/this-Cunningham/pr-controller.git');
  // anything not 'https' falls back to ssh
  assert.equal(
    cloneUrl('o/r', { host: 'h', protocol: 'whatever' }),
    'git@h:o/r.git');
  // round-trips: the produced URL still parses back to the same slug
  assert.equal(repoSlug(cloneUrl('o/r', { host: 'github.com', protocol: 'https' })), 'o/r');
  assert.equal(repoSlug(cloneUrl('o/r', { host: 'github.com', protocol: 'ssh' })), 'o/r');
});

test('cloneUrl: defaults to config.host + config.gitProtocol', () => {
  assert.equal(cloneUrl('o/r'), cloneUrl('o/r', { host: config.host, protocol: config.gitProtocol }));
});

test('configProblems: a fully configured config has no problems', () => {
  assert.deepEqual(configProblems({ login: 'alice', onlyPRs: ['r#1'] }), []);
});

test('configProblems: missing login is flagged', () => {
  const p = configProblems({ login: '', onlyPRs: ['r#1'] });
  assert.equal(p.length, 1);
  assert.match(p[0], /PRC_LOGIN/);
});

test('configProblems: empty scope is flagged UNLESS PRC_ALL_PRS opt-in', () => {
  // empty scope, no opt-in -> a problem (must not silently work ALL PRs)
  const p = configProblems({ login: 'alice', onlyPRs: [] }, { optInAllPrs: false });
  assert.equal(p.length, 1);
  assert.match(p[0], /scope|PRC_ONLY_PRS/);
  // explicit opt-in -> allowed
  assert.deepEqual(configProblems({ login: 'alice', onlyPRs: [] }, { optInAllPrs: true }), []);
});

test('configProblems: unconfigured config reports both login + scope', () => {
  assert.equal(configProblems({ login: '', onlyPRs: [] }, { optInAllPrs: false }).length, 2);
});
