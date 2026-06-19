// Canonical tone token maps for the status primitives. Each primitive imports the
// sub-map it needs. These are deliberately THREE SEPARATE maps, not one merged
// object: the same tone name (e.g. `accent`, `sage`) resolves to a different set of
// CSS-var properties in each context (Badge has a `border`; DispositionTag varies
// its border per tone; Callout uses rule/bg/mark instead of background/color). Do
// not merge them.
//
// This is the CANONICAL copy. Kept in sync MANUALLY with the vendored copy the app
// imports at pr-controller-react/src/design-system/tokens/tones.js. See README.md.

// Badge — review status (Approved/Review required/Draft) and PR signal pills.
export const BADGE_TONES = {
  neutral: { background: "var(--surface-2)", color: "var(--ink-2)", border: "transparent" },
  sage: { background: "var(--auto-bg)", color: "var(--auto-fg)", border: "transparent" },
  accent: { background: "var(--accent-bg)", color: "var(--accent)", border: "transparent" },
  praise: { background: "var(--praise-bg)", color: "var(--praise-fg)", border: "transparent" },
  outline: { background: "transparent", color: "var(--ink-3)", border: "var(--line-2)" },
};

// DispositionTag — how the agent classified a reviewer thread.
export const TAG_TONES = {
  accent: { background: "var(--accent-bg)", color: "var(--accent)", border: "none" }, // disagree / hash-out
  sage: { background: "var(--auto-bg)", color: "var(--auto-fg)", border: "none" }, // agree / auto-fix
  neutral: { background: "var(--surface-2)", color: "var(--ink-2)", border: "none" }, // waiting
  praise: { background: "var(--praise-bg)", color: "var(--praise-fg)", border: "none" }, // praise
  ochre: { background: "var(--err-bg)", color: "var(--err-fg)", border: "none" }, // agent error
  pending: { background: "transparent", color: "var(--pending-fg)", border: "1px dashed var(--pending-border)" }, // not yet judged
};

// Callout — left-ruled ambient status box (rule/bg/mark, not background/color).
export const CALLOUT_TONES = {
  urgency: { rule: "var(--accent)", bg: "var(--accent-soft)", mark: "var(--accent)" },
  agent: { rule: "var(--auto-fg)", bg: "var(--auto-bg)", mark: "var(--auto-fg)" },
  quiet: { rule: "var(--line-2)", bg: "var(--surface-2)", mark: "var(--ink-3)" },
};
