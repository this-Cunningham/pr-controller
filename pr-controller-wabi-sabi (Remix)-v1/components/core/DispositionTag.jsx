import React from "react";

const tones = {
  accent: { background: "var(--accent-bg)", color: "var(--accent)", border: "none" }, // needs your input
  sage: { background: "var(--auto-bg)", color: "var(--auto-fg)", border: "none" }, // agent fixed · waiting on reviewer
  neutral: { background: "var(--surface-2)", color: "var(--ink-2)", border: "none" }, // waiting on reviewer
  praise: { background: "var(--praise-bg)", color: "var(--praise-fg)", border: "none" }, // praise
  ochre: { background: "var(--err-bg)", color: "var(--err-fg)", border: "none" }, // agent error
  pending: { background: "transparent", color: "var(--pending-fg)", border: "1px dashed var(--pending-border)" }, // no feedback yet
};

/**
 * Uppercase mono disposition tag for a reviewer thread. Six tones map
 * to the agent's classification. `pending` (dashed, unfilled) is the
 * agent-hasn't-judged-yet state — quieter than `neutral` (waiting).
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
        padding: t.border === "none" ? "3px 8px" : "2px 7px",
        borderRadius: "var(--radius-chip)",
        background: t.background,
        color: t.color,
        border: t.border,
      }}
    >
      {children}
    </span>
  );
}
