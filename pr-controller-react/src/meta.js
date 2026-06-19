// Presentational metadata maps shared across components.
//
// Colors/typography are NOT defined here — each entry names a design-system
// *tone* (the Badge / DispositionTag tone vocabulary), and the design-system
// component resolves it to the right token-backed background/foreground. This
// keeps the design system the single source of truth for look & feel.
//
// Tone vocabulary (see ./design-system Badge.jsx / DispositionTag.jsx):
//   accent (urgency) · sage (auto/approved) · neutral (waiting) ·
//   praise · ochre (agent error) · outline (draft).

// Thread disposition tags → DispositionTag tone + label.
// Labels are the app's (they mirror the backend's real tiers, which are richer
// than the design-system's reference set — e.g. pending / working).
export const tagMeta = {
  hashout: { tone: 'accent', label: 'surfaced · your call' },
  agree: { tone: 'sage', label: 'agree · auto-fix' },
  waiting: { tone: 'neutral', label: 'waiting on reviewer' },
  // The design system now ships a dedicated faint, dashed `pending` tone for the
  // agent-hasn't-judged-yet state — quieter than `neutral` (waiting).
  pending: { tone: 'pending', label: 'no feedback yet' },
  working: { tone: 'sage', label: 'agent working…' },
  praise: { tone: 'praise', label: 'praise' },
  error: { tone: 'ochre', label: 'agent error' },
};

// Review-status pill → Badge tone (rendered mono).
export const reviewMeta = {
  APPROVED: { tone: 'sage', label: 'Approved' },
  REVIEW_REQUIRED: { tone: 'neutral', label: 'Review required' },
  DRAFT: { tone: 'outline', label: 'Draft' },
};

// PR signal pill → Badge tone (+ leading dot where appropriate).
export const pillMeta = {
  auto: { tone: 'neutral', dot: true },
  behind: { tone: 'neutral', dot: false },
  ci: { tone: 'accent', dot: false },
  working: { tone: 'sage', dot: true },
};

export const noActionLabel = (tag) =>
  tag === 'praise'
    ? 'No action needed — positive feedback.'
    : 'No action needed — waiting on the reviewer.';
