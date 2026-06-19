import React from "react";

const tones = {
  accent: { background: "var(--accent-bg)", color: "var(--accent)" }, // disagree / hash-out
  sage: { background: "var(--auto-bg)", color: "var(--auto-fg)" }, // agree / auto-fix
  neutral: { background: "var(--surface-2)", color: "var(--ink-2)" }, // waiting
  praise: { background: "var(--praise-bg)", color: "var(--praise-fg)" }, // praise
  ochre: { background: "var(--err-bg)", color: "var(--err-fg)" }, // agent error
};

/**
 * Uppercase mono disposition tag for a reviewer thread. Five tones map
 * to the agent's classification of a comment thread.
 */
export function DispositionTag({ tone = "neutral", children }) {
  const t = tones[tone] || tones.neutral;
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        letterSpacing: "var(--tracking-tag)",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: "var(--radius-chip)",
        background: t.background,
        color: t.color,
      }}
    >
      {children}
    </span>
  );
}
