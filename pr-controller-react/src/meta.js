// Presentational metadata maps shared across components.
// All colors reference CSS custom properties from theme.css.

export const tagMeta = {
  hashout: { label: 'disagree · hash out', bg: 'var(--accent-bg)', fg: 'var(--accent)' },
  agree: { label: 'agree · auto-fix', bg: 'var(--auto-bg)', fg: 'var(--auto-fg)' },
  waiting: { label: 'waiting on reviewer', bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
  pending: { label: 'no feedback yet', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  praise: { label: 'praise', bg: 'var(--praise-bg)', fg: 'var(--praise-fg)' },
  error: { label: 'agent error', bg: 'var(--err-bg)', fg: 'var(--err-fg)' },
};

export const reviewMeta = {
  APPROVED: { label: 'Approved', bg: 'var(--auto-bg)', fg: 'var(--auto-fg)', bd: 'transparent' },
  REVIEW_REQUIRED: { label: 'Review required', bg: 'var(--surface-2)', fg: 'var(--ink-2)', bd: 'transparent' },
  DRAFT: { label: 'Draft', bg: 'transparent', fg: 'var(--ink-3)', bd: 'var(--line-2)' },
};

export const pillMeta = {
  auto: { bg: 'var(--surface-2)', fg: 'var(--ink-2)', dot: true },
  behind: { bg: 'var(--surface-2)', fg: 'var(--ink-2)', dot: false },
  ci: { bg: 'var(--accent-bg)', fg: 'var(--accent)', dot: false },
};

export const noActionLabel = (tag) =>
  tag === 'praise'
    ? 'No action needed — positive feedback.'
    : 'No action needed — waiting on the reviewer.';
