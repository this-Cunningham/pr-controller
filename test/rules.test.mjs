// Locks the deterministic behavior of pr-controller. Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dispatchable, categorizeChecks, needsJira, rebaseAllowed, repoSlug, inScope, deriveTier,
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

test('deriveTier: worker surfaced -> hash-out with the code-cited reason', () => {
  const r = deriveTier({ lastAuthor: 'jheipler' }, { response: 'surface', reason: 'breaks the guard' }, ME2);
  assert.equal(r.tier, 'hash-out');
  assert.equal(r.reason, 'breaks the guard');
});

test('deriveTier: worker fixed -> waiting-reviewer', () => {
  const r = deriveTier({ lastAuthor: ME2 }, { response: 'fix', reason: 'fixed it' }, ME2);
  assert.equal(r.tier, 'waiting-reviewer');
});

test('deriveTier: worker praised -> waiting-reviewer', () => {
  assert.equal(deriveTier({ lastAuthor: ME2 }, { response: 'praise' }, ME2).tier, 'waiting-reviewer');
});

test('deriveTier: no worker action, reviewer last word -> pending (no feedback yet)', () => {
  assert.equal(deriveTier({ lastAuthor: 'jheipler' }, undefined, ME2).tier, 'pending');
});

test('deriveTier: no worker action, I replied last -> waiting-reviewer', () => {
  assert.equal(deriveTier({ lastAuthor: ME2 }, undefined, ME2).tier, 'waiting-reviewer');
});

test('deriveTier: thread error -> error', () => {
  assert.equal(deriveTier({ error: 'scan failed' }, undefined, ME2).tier, 'error');
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
