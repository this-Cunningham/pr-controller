// ============================================================
// Mock PR data. In production, replace this module with data
// fetched from the PR-agent backend. The shape mirrors the
// agent's state.json. The unit is the ITEM: each thread's tag
// and each PR's branch route to a tab (see TAG_TAB / BRANCH_TAB),
// so a single PR can appear in more than one tab at once.
//
//   PR:     { id, repo, number, title, review, jira?, pills[], branch?, threads[] }
//   review: 'APPROVED' | 'REVIEW_REQUIRED' | 'DRAFT'
//   pill:   { label, kind: 'behind' | 'ci' }
//   branch: { kind: 'conflict' | 'surfaced' | 'outofsync', detail?, details? }
//   thread: { id, tag, loc, author, body, reasonSummary, reasonFull?, approach?, reply? }
//   tag:    'input' | 'fixed' | 'waiting' | 'pending' | 'praise' | 'error'
// ============================================================
import { TAG_TAB, BRANCH_TAB } from './meta.js';

const pr2412 = {
  id: 'pr2412',
  repo: 'acme/web-app',
  number: 2412,
  title: 'Refactor auth middleware to support SSO',
  review: 'REVIEW_REQUIRED',
  pills: [
    { label: 'behind base', kind: 'behind' },
    { label: 'CI failing: unit-api', kind: 'ci' },
  ],
  branch: { kind: 'conflict' },
  threads: [
    {
      id: 't1',
      tag: 'input',
      loc: 'src/auth/middleware.ts:88',
      author: '@dana-k',
      body: 'This breaks the existing token-refresh path — we short-circuit on expired tokens so the client can silently re-auth. If you drop the early return, every expired request 500s instead of refreshing. Please keep the guard.',
      reasonSummary: 'Reviewer disputes the change — needs your judgment.',
      reasonFull:
        'The reviewer is right that the early return powers silent re-auth. The agent can’t tell whether SSO is meant to replace that path or sit beside it — that’s a product call, so it surfaced the thread with a drafted reply rather than guessing.',
      reply:
        'Good catch — SSO sits alongside the existing refresh path, it doesn’t replace it. I’ll keep the expired-token guard and add the SSO branch above it. Pushing a fix shortly.',
    },
    {
      id: 't2',
      tag: 'fixed',
      loc: 'src/auth/sso.ts:142',
      author: '@marco',
      body: 'Nit: use const here and destructure the config object instead of repeated property access.',
      reasonSummary: 'Mechanical refactor — fixed and replied to the reviewer.',
      reasonFull:
        'Pure style change with no behavior impact, so the agent applied it, replied “fixed”, and left the thread open for @marco to confirm.',
    },
    {
      id: 't3',
      tag: 'pending',
      loc: 'src/auth/sso.ts:201',
      author: '@priya',
      body: 'Should this read the issuer from env rather than hardcoding it?',
      reasonSummary: 'Queued — the agent hasn’t judged this yet.',
    },
  ],
};

const pr874 = {
  id: 'pr874',
  repo: 'acme/data-pipeline',
  number: 874,
  title: 'Add backfill job for the events table',
  review: 'DRAFT',
  jira: true,
  pills: [{ label: 'CI failing: lint', kind: 'ci' }],
  threads: [
    {
      id: 't4',
      tag: 'input',
      loc: 'jobs/backfill.py:55',
      author: '@priya',
      body: 'Backfilling synchronously will hold a lock on events for hours in prod. This needs to be chunked with checkpoints, or run against a replica. I’d block on this.',
      reasonSummary: 'Architectural concern with prod impact — your call.',
      reasonFull:
        'The agent agrees the synchronous lock is unsafe in prod, but rewriting the job to chunk-and-checkpoint changes runtime behavior, so it drafted an approach for your approval instead of applying it.',
      approach:
        'Rewrite the job to process events in 10k-row chunks against a checkpoint table, and target the read replica for the scan. Keep the synchronous path behind a --small flag for local runs.',
    },
  ],
};

const pr561 = {
  id: 'pr561',
  repo: 'acme/design-system',
  number: 561,
  title: 'Tokenize the spacing scale',
  review: 'REVIEW_REQUIRED',
  pills: [{ label: 'behind base', kind: 'behind' }],
  branch: {
    kind: 'surfaced',
    details:
      'The rebase touched tokens/spacing.json, where both branches renamed the same keys. Auto-merging would silently drop one side’s rename — the agent stopped rather than guess which wins.',
  },
  threads: [
    {
      id: 't7',
      tag: 'fixed',
      loc: 'tokens/spacing.json:12',
      author: '@lee',
      body: 'Base unit should be 4px, not 5 — matches the grid.',
      reasonSummary: 'Matched the documented grid — fixed, waiting on @lee.',
    },
  ],
};

const pr2399 = {
  id: 'pr2399',
  repo: 'acme/web-app',
  number: 2399,
  title: 'Bump lodash to 4.17.21',
  review: 'APPROVED',
  pills: [],
  threads: [
    { id: 't5', tag: 'fixed', loc: 'package.json:24', author: '@deps-bot', body: 'Lockfile is out of sync with package.json.', reasonSummary: 'Regenerated the lockfile — waiting on the reviewer.' },
    { id: 't6', tag: 'waiting', loc: 'CHANGELOG.md:1', author: '@sam', body: 'LGTM once the changelog entry lands.', reasonSummary: 'You added the entry — waiting on @sam to re-approve.' },
    { id: 't13', tag: 'pending', loc: 'src/index.ts:3', author: '@ci-bot', body: 'Bundle-size check still running.', reasonSummary: 'Queued — the agent hasn’t reviewed this yet.' },
  ],
};

const pr990 = {
  id: 'pr990',
  repo: 'acme/api',
  number: 990,
  title: 'Add rate limiting to the public API',
  review: 'REVIEW_REQUIRED',
  pills: [],
  threads: [
    {
      id: 'te1',
      tag: 'error',
      loc: '.github/workflows/ci.yml:30',
      author: '@ci-bot',
      body: 'Step “cache restore” failed to parse — unexpected key “path” at line 30.',
      reasonSummary: 'The agent couldn’t classify this failure.',
      reasonFull:
        'The run failed before any test executed, with a YAML parse error the agent doesn’t have enough context to fix safely. Open a terminal to inspect.',
    },
    { id: 'te2', tag: 'pending', loc: 'src/limiter.ts:44', author: '@marco', body: 'Does this handle burst windows correctly?', reasonSummary: 'Queued — the agent is reviewing this now.' },
  ],
};

const pr2380 = {
  id: 'pr2380',
  repo: 'acme/web-app',
  number: 2380,
  title: 'Docs: clarify local env setup',
  review: 'APPROVED',
  pills: [],
  threads: [
    { id: 'tp1', tag: 'praise', loc: 'README.md:42', author: '@dana-k', body: 'This was overdue — much clearer now.', reasonSummary: 'Positive feedback — no action.' },
    { id: 'tw1', tag: 'waiting', loc: 'README.md:60', author: '@sam', body: 'One tiny follow-up in-thread, nothing blocking.', reasonSummary: 'Waiting on @sam.' },
  ],
};

const pr203 = {
  id: 'pr203',
  repo: 'acme/infra',
  number: 203,
  title: 'Bump terraform aws provider to 5.x',
  review: 'REVIEW_REQUIRED',
  pills: [],
  branch: { kind: 'outofsync' },
  threads: [],
};

// Flat PR list — sections are DERIVED by routing each item to a tab.
export const PRS = [pr2412, pr874, pr561, pr2399, pr990, pr2380, pr203];

/** Does this PR have at least one item routing to `tab`? */
export function prInTab(pr, tab) {
  const hasThread = (pr.threads || []).some((t) => TAG_TAB[t.tag] === tab);
  const hasBranch = pr.branch && BRANCH_TAB[pr.branch.kind] === tab;
  const hasJira = !!pr.jira && tab === 'needs';
  return hasThread || hasBranch || hasJira;
}

// Section definitions in priority order (top = most urgent).
export const SECTION_DEFS = [
  { key: 'needs', title: 'Needs you', needsYou: true, caption: 'Resolve these before the agent continues.', empty: 'Nothing needs you right now.' },
  { key: 'progress', title: 'In progress', needsYou: false, caption: 'The agent is working on these — just glance.', empty: 'Nothing in progress.' },
  { key: 'waiting', title: 'Waiting on reviewer', needsYou: false, caption: 'Addressed — waiting on the reviewer.', empty: 'Nothing waiting on a reviewer.' },
];

/** Build the live sections (each with its routed PR slice). */
export function buildSections() {
  return SECTION_DEFS.map((d) => ({ ...d, prs: PRS.filter((pr) => prInTab(pr, d.key)) }));
}

export const OPEN_COUNT = PRS.length;
export const NEED_COUNT = PRS.filter((pr) => prInTab(pr, 'needs')).length;

// ── Reference examples for the Components gallery ─────────────
export const EX_NEEDS = pr2412; // appears in all three tabs
export const EX_CALM = pr2399; // waiting / calm
export const EX_DENSE = pr561; // surfaced rebase + fixed thread
export const EX_INPUT = pr874; // suggested approach + Run agent

// Synthetic branch-health examples.
export const GALLERY_CONFLICT = { id: 'gConflict', repo: 'acme/web-app', number: 9101, title: 'Merge conflict resolving automatically', review: 'REVIEW_REQUIRED', pills: [], branch: { kind: 'conflict' }, threads: [] };
export const GALLERY_SURFACED = { id: 'gSurfaced', repo: 'acme/web-app', number: 9102, title: 'Rebase surfaced for a human', review: 'REVIEW_REQUIRED', pills: [], branch: { kind: 'surfaced', details: 'Both branches renamed the same export — the agent stopped rather than pick a side.' }, threads: [] };
export const GALLERY_SYNC = { id: 'gSync', repo: 'acme/web-app', number: 9103, title: 'Branch out of sync with remote', review: 'DRAFT', pills: [], branch: { kind: 'outofsync' }, threads: [] };

// One PR showing every thread disposition.
export const GALLERY_ALL = {
  id: 'gAll',
  repo: 'acme/web-app',
  number: 9001,
  title: 'One PR showing every thread disposition',
  review: 'REVIEW_REQUIRED',
  pills: [],
  threads: [
    { id: 'ga1', tag: 'input', loc: 'src/x.ts:10', author: '@dana-k', body: 'I disagree with this change — please keep the old behavior.', reasonSummary: 'Conflicting intent — your call.', reply: 'Keeping the old behavior — reverting this hunk and adding a regression test.' },
    { id: 'ga2', tag: 'fixed', loc: 'src/x.ts:20', author: '@marco', body: 'Nit: rename to camelCase.', reasonSummary: 'Mechanical — fixed, waiting on the reviewer.' },
    { id: 'ga3', tag: 'waiting', loc: 'src/x.ts:30', author: '@sam', body: 'Looks good, will approve shortly.', reasonSummary: 'Waiting on the reviewer.' },
    { id: 'ga6', tag: 'pending', loc: 'src/x.ts:35', author: '@ci-bot', body: 'Coverage check still running.', reasonSummary: 'Queued — the agent hasn’t reviewed this yet.' },
    { id: 'ga4', tag: 'praise', loc: 'src/x.ts:40', author: '@lee', body: 'Nice cleanup here!', reasonSummary: 'Positive feedback.' },
    { id: 'ga5', tag: 'error', loc: 'ci.yml:5', author: '@ci-bot', body: 'Step failed to parse.', reasonSummary: 'Agent couldn’t classify.' },
  ],
};

export const GALLERY_JIRA = { id: 'gJira', repo: 'acme/web-app', number: 9003, title: 'Add an export button to reports', review: 'REVIEW_REQUIRED', jira: true, pills: [], threads: [] };
export const GALLERY_JIRA_SET = { id: 'gjset', repo: 'acme/web-app', number: 9004, title: 'Add an import button [ACME-204]', review: 'REVIEW_REQUIRED', jira: true, pills: [], threads: [] };

// Seed for the gallery's own dashboard instance (pre-resolved states).
export const GALLERY_SEED = {
  skipLoading: true,
  threads: {
    ga2: { replySent: false },
    t4: { approachStaged: true }, // pre-stage so the Run agent footer shows
  },
  runs: {},
  jira: { gjset: { status: 'set', value: 'ACME-204' } },
};
