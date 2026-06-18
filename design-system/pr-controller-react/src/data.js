// ============================================================
// Mock PR data. In production, replace this module with data
// fetched from the PR-agent backend. The shape mirrors the
// agent's state.json:
//   PR:     { id, repo, number, title, review, jira, pills[], threads[] }
//   review: 'APPROVED' | 'REVIEW_REQUIRED' | 'DRAFT'
//   pill:   { label, kind: 'auto' | 'behind' | 'ci' }
//   thread: { id, tag, loc, author, body, reason }
//   tag:    'hashout' | 'agree' | 'waiting' | 'praise' | 'error'
// ============================================================

const pr2412 = {
  id: 'pr2412',
  repo: 'acme/web-app',
  number: 2412,
  title: 'Refactor auth middleware to support SSO',
  review: 'REVIEW_REQUIRED',
  jira: true,
  pills: [
    { label: '3 auto-fixable', kind: 'auto' },
    { label: 'behind base', kind: 'behind' },
    { label: 'CI failing: unit-api', kind: 'ci' },
  ],
  threads: [
    {
      id: 't1',
      tag: 'hashout',
      loc: 'src/auth/middleware.ts:88',
      author: '@dana-k',
      body: 'This breaks the existing token-refresh path — we short-circuit on expired tokens so the client can silently re-auth. If you drop the early return, every expired request 500s instead of refreshing. Please keep the guard.',
      reason: 'Reviewer disputes the change — conflicting intent, your call.',
    },
    {
      id: 't2',
      tag: 'agree',
      loc: 'src/auth/sso.ts:142',
      author: '@marco',
      body: 'Nit: use const here and destructure the config object instead of repeated property access.',
      reason: 'Mechanical refactor, no behavior change — safe to auto-apply.',
    },
    {
      id: 't3',
      tag: 'error',
      loc: '.github/workflows/ci.yml:30',
      author: '@ci-bot',
      body: 'Step “cache restore” failed to parse — unexpected key “path” at line 30.',
      reason: 'Agent couldn’t classify this failure automatically.',
    },
  ],
};

const pr874 = {
  id: 'pr874',
  repo: 'acme/data-pipeline',
  number: 874,
  title: 'Add backfill job for the events table',
  review: 'DRAFT',
  jira: false,
  pills: [{ label: 'CI failing: lint', kind: 'ci' }],
  threads: [
    {
      id: 't4',
      tag: 'hashout',
      loc: 'jobs/backfill.py:55',
      author: '@priya',
      body: 'Backfilling synchronously will hold a lock on events for hours in prod. This needs to be chunked with checkpoints, or run against a replica. I’d block on this.',
      reason: 'Architectural concern with prod impact — your decision.',
    },
  ],
};

const pr2399 = {
  id: 'pr2399',
  repo: 'acme/web-app',
  number: 2399,
  title: 'Bump lodash to 4.17.21',
  review: 'APPROVED',
  jira: false,
  pills: [{ label: '2 auto-fixable', kind: 'auto' }],
  threads: [
    {
      id: 't5',
      tag: 'agree',
      loc: 'package.json:24',
      author: '@deps-bot',
      body: 'Lockfile is out of sync with package.json.',
      reason: 'Regenerating lockfile — deterministic, auto-applied.',
    },
    {
      id: 't6',
      tag: 'waiting',
      loc: 'CHANGELOG.md:1',
      author: '@sam',
      body: 'LGTM once the changelog entry lands.',
      reason: 'Waiting on the reviewer to re-approve.',
    },
  ],
};

const pr561 = {
  id: 'pr561',
  repo: 'acme/design-system',
  number: 561,
  title: 'Tokenize the spacing scale',
  review: 'REVIEW_REQUIRED',
  jira: false,
  pills: [
    { label: '5 auto-fixable', kind: 'auto' },
    { label: 'behind base', kind: 'behind' },
  ],
  threads: [
    { id: 't7', tag: 'agree', loc: 'tokens/spacing.json:12', author: '@lee', body: 'Base unit should be 4px, not 5 — matches the grid.', reason: 'Matches the documented grid — auto-fixing.' },
    { id: 't8', tag: 'agree', loc: 'tokens/spacing.json:30', author: '@lee', body: 'Missing an xl token between lg and 2xl.', reason: 'Adding the token per the scale spec.' },
    { id: 't9', tag: 'agree', loc: 'components/Stack.tsx:8', author: '@lee', body: 'Import order — group external before internal.', reason: 'Lint-aligned reorder.' },
    { id: 't10', tag: 'praise', loc: 'tokens/spacing.json:1', author: '@lee', body: 'Really clean approach to this, thank you.', reason: 'Positive feedback — no action.' },
  ],
};

const pr2380 = {
  id: 'pr2380',
  repo: 'acme/web-app',
  number: 2380,
  title: 'Docs: clarify local env setup',
  review: 'APPROVED',
  jira: false,
  pills: [],
  threads: [
    { id: 't11', tag: 'praise', loc: 'README.md:42', author: '@dana-k', body: 'This was overdue — much clearer now.', reason: 'Positive feedback — no action.' },
    { id: 't12', tag: 'waiting', loc: 'README.md:60', author: '@sam', body: 'One tiny follow-up in-thread, nothing blocking.', reason: 'Waiting on the reviewer.' },
  ],
};

const pr203 = {
  id: 'pr203',
  repo: 'acme/infra',
  number: 203,
  title: 'Bump terraform aws provider to 5.x',
  review: 'REVIEW_REQUIRED',
  jira: false,
  pills: [],
  threads: [],
};

// Sections in priority order (top = most urgent).
export const SECTIONS = [
  { key: 'needs', title: 'Needs you', needsYou: true, prs: [pr2412, pr874] },
  { key: 'auto', title: 'Auto-handling', needsYou: false, prs: [pr2399, pr561] },
  { key: 'waiting', title: 'Waiting on reviewer', needsYou: false, prs: [pr2380, pr203] },
];

export function sectionCaption(key, mode) {
  if (key === 'needs') return 'Resolve these before the agent continues.';
  if (key === 'auto')
    return mode === 'live'
      ? 'The agent is fixing these — just glance.'
      : 'Paused in safe mode — these would be auto-fixed when live.';
  return 'No action needed from you.';
}

export function emptyLabel(key) {
  if (key === 'needs') return 'Nothing needs you right now.';
  if (key === 'auto') return 'Nothing being auto-handled.';
  return 'Nothing waiting.';
}

export const OPEN_COUNT = SECTIONS.reduce((n, s) => n + s.prs.length, 0);
export const NEED_COUNT = SECTIONS.find((s) => s.key === 'needs').prs.length;

// ── Reference examples for the Components gallery ─────────────
// Convenience handles into the real data for single-card frames.
export const EX_NEEDS = pr2412; // needs-you emphasis (+ pills + JIRA)
export const EX_CALM = pr2399; // calm / auto-handled
export const EX_DENSE = pr561; // many threads
export const EX_NONE = pr203; // no threads

// One PR showing every thread disposition.
export const GALLERY_ALL = {
  id: 'gAll',
  repo: 'acme/web-app',
  number: 9001,
  title: 'One PR showing every thread disposition',
  review: 'REVIEW_REQUIRED',
  jira: false,
  pills: [{ label: '2 auto-fixable', kind: 'auto' }],
  threads: [
    { id: 'ga1', tag: 'hashout', loc: 'src/x.ts:10', author: '@dana-k', body: 'I disagree with this change — please keep the old behavior.', reason: 'Conflicting intent — your call.' },
    { id: 'ga2', tag: 'agree', loc: 'src/x.ts:20', author: '@marco', body: 'Nit: rename to camelCase.', reason: 'Mechanical — safe to auto-apply.' },
    { id: 'ga3', tag: 'waiting', loc: 'src/x.ts:30', author: '@sam', body: 'Looks good, will approve shortly.', reason: 'Waiting on the reviewer.' },
    { id: 'ga4', tag: 'praise', loc: 'src/x.ts:40', author: '@lee', body: 'Nice cleanup here!', reason: 'Positive feedback.' },
    { id: 'ga5', tag: 'error', loc: 'ci.yml:5', author: '@ci-bot', body: 'Step failed to parse.', reason: 'Agent couldn’t classify.' },
  ],
};

// Threads pre-set to their confirmation states (seeded via GALLERY_SEED).
export const GALLERY_TAKEN = {
  id: 'gTaken',
  repo: 'acme/web-app',
  number: 9002,
  title: 'After you act — confirmation states',
  review: 'APPROVED',
  jira: false,
  pills: [],
  threads: [
    { id: 'gt1', tag: 'agree', loc: 'src/a.ts:1', author: '@marco', body: 'Use const here.', reason: 'Mechanical fix.' },
    { id: 'gt3', tag: 'agree', loc: 'src/b.ts:2', author: '@marco', body: 'Remove the unused import.', reason: 'Lint fix.' },
    { id: 'gt2', tag: 'hashout', loc: 'jobs/x.py:9', author: '@priya', body: 'This will lock the table in prod.', reason: 'Architectural — your call.' },
  ],
};

export const GALLERY_JIRA = {
  id: 'gJira',
  repo: 'acme/web-app',
  number: 9003,
  title: 'Add an export button to reports',
  review: 'REVIEW_REQUIRED',
  jira: true,
  pills: [],
  threads: [],
};

export const GALLERY_JIRA_SET = {
  id: 'gjset',
  repo: 'acme/web-app',
  number: 9004,
  title: 'Add an import button [ACME-204]',
  review: 'REVIEW_REQUIRED',
  jira: true,
  pills: [],
  threads: [],
};

// Seed for the gallery's own dashboard instance (pre-resolved states).
export const GALLERY_SEED = {
  skipLoading: true,
  threads: {
    gt1: { status: 'approved' },
    gt3: { status: 'skipped' },
    gt2: {
      status: 'rebutted',
      rebuttal: 'The lock is intentional — this runs in the maintenance window, never during prod hours.',
    },
  },
  jira: { gjset: { status: 'set', value: 'ACME-204' } },
};
