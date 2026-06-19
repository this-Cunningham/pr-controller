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

// Thread disposition tags → DispositionTag tone + label. Keyed by the shared
// disposition vocabulary (rules.deriveTier). Labels are the app's (richer than the
// design-system's reference tone set — e.g. notYetReviewed / agentAcknowledged).
export const tagMeta = {
  needsYourApproval: { tone: 'accent', label: 'needs your input' },
  agentAutoFixed: { tone: 'sage', label: 'agent fixed · waiting on reviewer' },
  awaitingReviewer: { tone: 'neutral', label: 'waiting on reviewer' },
  // The design system ships a dedicated faint, dashed `pending` tone for the
  // agent-hasn't-judged-yet state — quieter than `neutral` (waiting).
  notYetReviewed: { tone: 'pending', label: 'no feedback yet' },
  agentAcknowledged: { tone: 'praise', label: 'praise' },
  agentError: { tone: 'ochre', label: 'agent error' },
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
};

export const noActionLabel = (tag) =>
  tag === 'agentAcknowledged'
    ? 'No action needed — positive feedback.'
    : 'No action needed — waiting on the reviewer.';
