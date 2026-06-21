// Locks the PURE/extractable scanner helpers (no network). Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isRateLimitError,
  isLivePrNode,
  classifyGhError,
  parsePullRequest,
  buildBatchedQuery,
  parseBatchedResponse,
  shouldReenrich,
} from '../scanner.mjs';

// A fixture mirroring the real GraphQL `pullRequest` node shape (one unresolved
// reviewer thread, one resolved thread to be dropped, one failing CI context).
function prNodeFixture(overrides = {}) {
  return {
    reviewDecision: 'APPROVED',
    headRefName: 'feature/x',
    baseRefName: 'main',
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    commits: {
      nodes: [{
        commit: {
          statusCheckRollup: {
            state: 'FAILURE',
            contexts: {
              nodes: [
                { __typename: 'CheckRun', name: 'unit-tests', conclusion: 'FAILURE', status: 'COMPLETED', detailsUrl: 'http://ci/1' },
                { __typename: 'StatusContext', context: 'lint', state: 'SUCCESS', targetUrl: 'http://ci/2' },
              ],
            },
          },
        },
      }],
    },
    reviewThreads: {
      nodes: [
        {
          id: 'T_kept', isResolved: false, isOutdated: false, path: 'src/a.js', line: 12,
          comments: { nodes: [
            { databaseId: 1, author: { login: 'reviewer' }, body: 'please fix this', createdAt: 't0', url: 'http://c/1' },
            { databaseId: 2, author: { login: 'reviewer' }, body: 'still broken', createdAt: 't1', url: 'http://c/2' },
          ] },
        },
        {
          id: 'T_resolved', isResolved: true, isOutdated: false, path: 'src/b.js', line: 3,
          comments: { nodes: [{ databaseId: 3, author: { login: 'reviewer' }, body: 'done', createdAt: 't0', url: 'http://c/3' }] },
        },
      ],
    },
    ...overrides,
  };
}

// --- parsePullRequest -------------------------------------------------------

test('parsePullRequest: returns expected threads + branchHealth shape', () => {
  const r = parsePullRequest(prNodeFixture());
  assert.equal(r.reviewDecision, 'APPROVED');
  assert.equal(r.headRefName, 'feature/x');
  assert.equal(r.baseRefName, 'main');
  // resolved thread is dropped; only the unresolved one survives
  assert.equal(r.threads.length, 1);
  const t = r.threads[0];
  assert.equal(t.threadId, 'T_kept');
  assert.equal(t.author, 'reviewer');
  assert.equal(t.lastAuthor, 'reviewer');
  assert.equal(t.lastBody, 'still broken');
  assert.equal(t.commentCount, 2);
  // branch health: the failing CheckRun is code CI; lint SUCCESS is excluded
  assert.equal(r.branchHealth.mergeable, 'MERGEABLE');
  assert.equal(r.branchHealth.mergeState, 'CLEAN');
  assert.equal(r.branchHealth.checkState, 'FAILURE');
  assert.equal(r.branchHealth.failingChecks.length, 1);
  assert.equal(r.branchHealth.failingChecks[0].name, 'unit-tests');
});

test('parsePullRequest: null node -> null (tolerant for missing alias)', () => {
  assert.equal(parsePullRequest(null), null);
  assert.equal(parsePullRequest(undefined), null);
});

test('parsePullRequest: empty review threads / no rollup -> empty, no throw', () => {
  const r = parsePullRequest({
    reviewDecision: 'NONE', headRefName: 'h', baseRefName: 'b',
    mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN',
    commits: { nodes: [] }, reviewThreads: { nodes: [] },
  });
  assert.deepEqual(r.threads, []);
  assert.equal(r.branchHealth.checkState, null);
  assert.deepEqual(r.branchHealth.failingChecks, []);
});

// --- buildBatchedQuery ------------------------------------------------------

test('buildBatchedQuery: one aliased block per PR with matching variables', () => {
  const prs = [
    { nameWithOwner: 'orgA/repo1', number: 5 },
    { nameWithOwner: 'orgB/repo2', number: 9 },
  ];
  const { query, variables } = buildBatchedQuery(prs);
  // per-PR aliases p0, p1
  assert.match(query, /p0: repository\(owner:\$o0, name:\$n0\)/);
  assert.match(query, /pullRequest\(number:\$num0\)/);
  assert.match(query, /p1: repository\(owner:\$o1, name:\$n1\)/);
  assert.match(query, /pullRequest\(number:\$num1\)/);
  // variable declarations present in the operation signature
  assert.match(query, /\$o0:String!, \$n0:String!, \$num0:Int!/);
  assert.match(query, /\$o1:String!, \$n1:String!, \$num1:Int!/);
  // cross-org owners split correctly, numbers coerced to Int
  assert.deepEqual(variables, {
    o0: 'orgA', n0: 'repo1', num0: 5,
    o1: 'orgB', n1: 'repo2', num1: 9,
  });
});

test('buildBatchedQuery: empty list -> valid-ish query, no variables', () => {
  const { query, variables } = buildBatchedQuery([]);
  assert.deepEqual(variables, {});
  assert.match(query, /^\s*query\(\)/);
});

// --- parseBatchedResponse ---------------------------------------------------

test('parseBatchedResponse: aligns enriched records to PRs by alias', () => {
  const prs = [
    { nameWithOwner: 'orgA/repo1', number: 5, repo: 'repo1', title: 'A' },
    { nameWithOwner: 'orgB/repo2', number: 9, repo: 'repo2', title: 'B' },
  ];
  const data = {
    p0: { pullRequest: prNodeFixture() },
    p1: { pullRequest: prNodeFixture({ reviewDecision: 'CHANGES_REQUESTED' }) },
  };
  const out = parseBatchedResponse(prs, data);
  assert.equal(out.length, 2);
  // carries forward base meta + merges parsed enrichment
  assert.equal(out[0].title, 'A');
  assert.equal(out[0].number, 5);
  assert.equal(out[0].reviewDecision, 'APPROVED');
  assert.equal(out[0].threads.length, 1);
  assert.equal(out[1].reviewDecision, 'CHANGES_REQUESTED');
});

test('parseBatchedResponse: tolerates a missing/null alias -> null slot', () => {
  const prs = [
    { nameWithOwner: 'orgA/repo1', number: 5, repo: 'repo1' },
    { nameWithOwner: 'orgB/repo2', number: 9, repo: 'repo2' },
    { nameWithOwner: 'orgC/repo3', number: 1, repo: 'repo3' },
  ];
  const data = {
    p0: { pullRequest: prNodeFixture() },
    p1: { pullRequest: null }, // PR errored inside an otherwise-good batch
    // p2 absent entirely
  };
  const out = parseBatchedResponse(prs, data);
  assert.ok(out[0]);
  assert.equal(out[1], null);
  assert.equal(out[2], null);
});

test('parseBatchedResponse: null data -> all null slots, no throw', () => {
  const prs = [{ nameWithOwner: 'o/r', number: 1, repo: 'r' }];
  assert.deepEqual(parseBatchedResponse(prs, null), [null]);
});

// --- isRateLimitError -------------------------------------------------------

test('isRateLimitError: primary rate limit message -> true', () => {
  assert.equal(isRateLimitError(new Error('API rate limit exceeded for user')), true);
});

test('isRateLimitError: secondary rate limit message -> true', () => {
  assert.equal(isRateLimitError(new Error('You have exceeded a secondary rate limit')), true);
});

test('isRateLimitError: "was submitted too quickly" -> true', () => {
  assert.equal(isRateLimitError(new Error('was submitted too quickly')), true);
});

test('isRateLimitError: 403 forbidden rate signal in stderr -> true', () => {
  assert.equal(isRateLimitError({ message: 'gh failed', stderr: 'HTTP 403: too many requests' }), true);
});

test('isRateLimitError: ordinary 404 error -> false', () => {
  assert.equal(isRateLimitError(new Error('HTTP 404: Could not resolve to a PullRequest')), false);
});

test('isRateLimitError: plain network error -> false', () => {
  assert.equal(isRateLimitError(new Error('connect ECONNREFUSED')), false);
});

test('isRateLimitError: null / undefined -> false', () => {
  assert.equal(isRateLimitError(null), false);
  assert.equal(isRateLimitError(undefined), false);
});

// --- shouldReenrich (updatedAt + floor decision) ----------------------------

test('shouldReenrich: unchanged updatedAt within floor -> skip', () => {
  const pr = { updatedAt: '2026-06-21T00:00:00Z' };
  const cached = { record: { foo: 1 }, updatedAt: '2026-06-21T00:00:00Z' };
  assert.equal(shouldReenrich(pr, cached, false), false);
});

test('shouldReenrich: changed updatedAt -> refetch', () => {
  const pr = { updatedAt: '2026-06-21T01:00:00Z' };
  const cached = { record: { foo: 1 }, updatedAt: '2026-06-21T00:00:00Z' };
  assert.equal(shouldReenrich(pr, cached, false), true);
});

test('shouldReenrich: floor reached -> refetch even if unchanged', () => {
  const pr = { updatedAt: '2026-06-21T00:00:00Z' };
  const cached = { record: { foo: 1 }, updatedAt: '2026-06-21T00:00:00Z' };
  assert.equal(shouldReenrich(pr, cached, true), true);
});

test('shouldReenrich: cold cache (no record) -> refetch', () => {
  const pr = { updatedAt: '2026-06-21T00:00:00Z' };
  assert.equal(shouldReenrich(pr, undefined, false), true);
  assert.equal(shouldReenrich(pr, { record: null, updatedAt: 'x' }, false), true);
});

// isLivePrNode guards scanOnePr's direct-fetch fast-path: GitHub returns the
// pullRequest node for CLOSED/MERGED PRs too, so only an OPEN node is "still live".
// Treating non-OPEN as live would leave a merged PR's worktree/session unreclaimed.
test('isLivePrNode: only an OPEN node is live', () => {
  assert.equal(isLivePrNode({ state: 'OPEN' }), true);
  assert.equal(isLivePrNode({ state: 'CLOSED' }), false);
  assert.equal(isLivePrNode({ state: 'MERGED' }), false);
  assert.equal(isLivePrNode(null), false);
  assert.equal(isLivePrNode(undefined), false);
  assert.equal(isLivePrNode({}), false); // no state field -> not live
});

// classifyGhError tags a scan failure so a throttle/auth/permission problem is
// distinguishable from a generic error instead of one opaque {error} thread.
test('classifyGhError: distinguishes rateLimit / auth / forbidden / graphql / other', () => {
  assert.equal(classifyGhError({ message: 'API rate limit exceeded for user' }), 'rateLimit');
  assert.equal(classifyGhError({ stderr: 'You have exceeded a secondary rate limit' }), 'rateLimit');
  assert.equal(classifyGhError({ message: 'HTTP 401: Bad credentials' }), 'auth');
  assert.equal(classifyGhError({ stderr: 'gh auth login required' }), 'auth');
  assert.equal(classifyGhError({ message: 'HTTP 403: Forbidden (insufficient permission)' }), 'forbidden');
  assert.equal(classifyGhError({ message: 'Could not resolve to a Repository with the name' }), 'graphql');
  assert.equal(classifyGhError({ message: 'HTTP 404: Not Found' }), 'graphql');
  assert.equal(classifyGhError({ message: 'socket hang up' }), 'other');
  assert.equal(classifyGhError(null), 'other');
});
