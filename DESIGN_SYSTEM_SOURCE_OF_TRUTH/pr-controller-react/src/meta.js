// Presentational metadata maps shared across components.
// All colors reference CSS custom properties from theme.css.

export const tagMeta = {
  input: { label: 'needs your input', bg: 'var(--accent-bg)', fg: 'var(--accent)' },
  fixed: { label: 'agent fixed · waiting on reviewer', bg: 'var(--auto-bg)', fg: 'var(--auto-fg)' },
  waiting: { label: 'waiting on reviewer', bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
  pending: { label: 'no feedback yet', bg: 'transparent', fg: 'var(--ink-3)', dashed: true },
  praise: { label: 'praise', bg: 'var(--praise-bg)', fg: 'var(--praise-fg)' },
  error: { label: 'agent error', bg: 'var(--err-bg)', fg: 'var(--err-fg)' },
};

export const reviewMeta = {
  APPROVED: { label: 'Approved', bg: 'var(--auto-bg)', fg: 'var(--auto-fg)', bd: 'transparent' },
  REVIEW_REQUIRED: { label: 'Review required', bg: 'var(--surface-2)', fg: 'var(--ink-2)', bd: 'transparent' },
  DRAFT: { label: 'Draft', bg: 'transparent', fg: 'var(--ink-3)', bd: 'var(--line-2)' },
};

// Signal pills are branch-state only now (no "N auto-fixable").
export const pillMeta = {
  behind: { bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
  ci: { bg: 'var(--accent-bg)', fg: 'var(--accent)' },
};

// Disposition tag → tab, and branch kind → tab. The unit is the ITEM,
// so one PR can route items into several tabs at once. praise → none.
export const TAG_TAB = { input: 'needs', error: 'needs', pending: 'progress', fixed: 'waiting', waiting: 'waiting', praise: null };
export const BRANCH_TAB = { conflict: 'progress', surfaced: 'needs', outofsync: 'needs' };

export const noActionLabel = (tag) =>
  tag === 'praise'
    ? 'No action needed — positive feedback.'
    : tag === 'fixed'
    ? 'No action needed — waiting on the reviewer to confirm.'
    : 'No action needed — waiting on the reviewer.';
