// Mock backend state for design validation, in the EXACT shape server.mjs writes
// to state.json (see adapt.js header). Loaded via the `?mock` URL param; it runs
// through the real adaptState() → real components, so it exercises the actual
// data pipeline rather than bypassing it like the seeded gallery does.
//
// Covers every state the live single-PR sandbox can't show: hash-out (with
// suggestedReply + suggestedApproach), agree-fix, praise, waiting, pending,
// error, needsJira, CI failing, behind base, needsRebase (conflict), outOfSync,
// worker-surfaced, draft, approved, and a clean no-threads PR — across all three
// dashboard sections.

const T = (over) => ({
  threadId: over.threadId,
  path: over.path,
  line: over.line,
  author: over.author || 'reviewer',
  lastAuthor: over.lastAuthor || over.author || 'reviewer',
  body: over.body || '',
  tier: over.tier,
  reason: over.reason || '',
  suggestedReply: over.suggestedReply,
  suggestedApproach: over.suggestedApproach,
  error: over.error,
});

const prs = [
  // ── NEEDS YOU ────────────────────────────────────────────────
  {
    number: 2412,
    title: 'Refactor auth middleware to support SSO',
    repo: 'site-vdp-remix',
    nameWithOwner: 'cargurus-eng/site-vdp-remix',
    url: '#',
    isDraft: false,
    reviewDecision: 'REVIEW_REQUIRED',
    needsYou: true,
    needsJira: true,
    behindBase: true,
    ciFailing: true,
    needsRebase: false,
    outOfSync: false,
    autoFixable: 1,
    pending: 0,
    branchHealth: { failingChecks: [{ name: 'unit-api' }], complianceChecks: [{ name: 'compliance/sox' }] },
    threads: [
      T({
        threadId: 't-hashout-1',
        path: 'app/auth/middleware.ts',
        line: 88,
        author: 'dana-k',
        tier: 'hash-out',
        body: 'This breaks the existing token-refresh path — we short-circuit on expired tokens so the client can silently re-auth. If you drop the early return, every expired request 500s instead of refreshing. Please keep the guard.',
        reason: 'Reviewer disputes the change — conflicting intent, your call.',
        suggestedReply:
          'The early return is intentional — it short-circuits expired tokens so the client silently re-auths. I kept it; the SSO path only adds a branch above it. Does that address the concern?',
        suggestedApproach:
          'Keep the guard and add the SSO branch above it, plus a regression test for the expired-token refresh path.',
      }),
      T({
        threadId: 't-agree-1',
        path: 'app/auth/sso.ts',
        line: 142,
        author: 'marco',
        tier: 'agree-fix',
        body: 'Nit: use const here and destructure the config object instead of repeated property access.',
        reason: 'Mechanical refactor, no behavior change — safe to auto-apply.',
      }),
      T({
        threadId: 't-error-1',
        path: '.github/workflows/ci.yml',
        line: 30,
        author: 'ci-bot',
        tier: 'error',
        error: 'Step "cache restore" failed to parse — unexpected key "path" at line 30.',
      }),
    ],
  },
  {
    number: 874,
    title: 'Add backfill job for the events table',
    repo: 'data-pipeline',
    nameWithOwner: 'cargurus-eng/data-pipeline',
    url: '#',
    isDraft: false,
    reviewDecision: 'REVIEW_REQUIRED',
    needsYou: true,
    needsJira: false,
    behindBase: false,
    ciFailing: false,
    needsRebase: true, // merge conflict → Rebase CTA
    outOfSync: false,
    autoFixable: 0,
    pending: 0,
    branchHealth: { failingChecks: [], complianceChecks: [] },
    threads: [
      T({
        threadId: 't-hashout-2',
        path: 'jobs/backfill.py',
        line: 55,
        author: 'priya',
        tier: 'hash-out',
        body: 'Backfilling synchronously will hold a lock on events for hours in prod. This needs to be chunked with checkpoints, or run against a replica. I’d block on this.',
        reason: 'Architectural concern with prod impact — your decision.',
        suggestedApproach:
          'Chunk the backfill into 10k-row batches with a checkpoint table, and run against the read replica. Bigger change — want your sign-off on scope.',
      }),
    ],
  },
  {
    number: 903,
    title: 'Tidy up the pricing helpers',
    repo: 'site-vdp-remix',
    nameWithOwner: 'cargurus-eng/site-vdp-remix',
    url: '#',
    isDraft: false,
    reviewDecision: 'REVIEW_REQUIRED',
    needsYou: true,
    needsJira: false,
    behindBase: false,
    ciFailing: false,
    needsRebase: false,
    outOfSync: true, // diverged — can't fast-forward
    autoFixable: 0,
    pending: 0,
    branchHealth: { failingChecks: [], complianceChecks: [] },
    threads: [],
  },

  // ── AUTO-HANDLING ────────────────────────────────────────────
  {
    number: 561,
    title: 'Tokenize the spacing scale',
    repo: 'chassis',
    nameWithOwner: 'cargurus-eng/chassis',
    url: '#',
    isDraft: false,
    reviewDecision: 'REVIEW_REQUIRED',
    needsYou: false,
    needsJira: false,
    behindBase: true,
    ciFailing: false,
    needsRebase: false,
    outOfSync: false,
    autoFixable: 3,
    pending: 1,
    branchHealth: { failingChecks: [], complianceChecks: [] },
    threads: [
      T({ threadId: 't-agree-2', path: 'tokens/spacing.json', line: 12, author: 'lee', tier: 'agree-fix', body: 'Base unit should be 4px, not 5 — matches the grid.', reason: 'Matches the documented grid — auto-fixing.' }),
      T({ threadId: 't-agree-3', path: 'tokens/spacing.json', line: 30, author: 'lee', tier: 'agree-fix', body: 'Missing an xl token between lg and 2xl.', reason: 'Adding the token per the scale spec.' }),
      T({ threadId: 't-agree-4', path: 'components/Stack.tsx', line: 8, author: 'lee', tier: 'agree-fix', body: 'Import order — group external before internal.', reason: 'Lint-aligned reorder.' }),
      T({ threadId: 't-pending-1', path: 'tokens/spacing.json', line: 1, author: 'lee', tier: 'pending', body: 'Could we also document the rationale for the base unit somewhere?', reason: 'No feedback yet — the agent hasn’t reviewed this thread.' }),
    ],
  },

  // ── WAITING ON REVIEWER ──────────────────────────────────────
  {
    number: 2399,
    title: 'Bump lodash to 4.17.21',
    repo: 'site-vdp-remix',
    nameWithOwner: 'cargurus-eng/site-vdp-remix',
    url: '#',
    isDraft: false,
    reviewDecision: 'APPROVED',
    needsYou: false,
    needsJira: false,
    behindBase: false,
    ciFailing: false,
    needsRebase: false,
    outOfSync: false,
    autoFixable: 0,
    pending: 0,
    branchHealth: { failingChecks: [], complianceChecks: [] },
    threads: [
      T({ threadId: 't-praise-1', path: 'package.json', line: 24, author: 'sam', tier: 'praise', body: 'Nice — glad to see this finally bumped.', reason: 'Positive feedback — no action.' }),
      T({ threadId: 't-waiting-1', path: 'CHANGELOG.md', line: 1, author: 'sam', lastAuthor: 'ccunningham', tier: 'waiting-reviewer', body: 'LGTM once the changelog entry lands.', reason: 'You replied last — waiting on the reviewer.' }),
    ],
  },
  {
    number: 203,
    title: 'Bump terraform aws provider to 5.x',
    repo: 'infra',
    nameWithOwner: 'cargurus-eng/infra',
    url: '#',
    isDraft: true,
    reviewDecision: 'REVIEW_REQUIRED',
    needsYou: false,
    needsJira: false,
    behindBase: false,
    ciFailing: false,
    needsRebase: false,
    outOfSync: false,
    autoFixable: 0,
    pending: 0,
    branchHealth: { failingChecks: [], complianceChecks: [] },
    threads: [],
  },
];

export const MOCK_STATE = {
  updatedAt: new Date().toISOString(),
  scope: [],
  prs,
};
