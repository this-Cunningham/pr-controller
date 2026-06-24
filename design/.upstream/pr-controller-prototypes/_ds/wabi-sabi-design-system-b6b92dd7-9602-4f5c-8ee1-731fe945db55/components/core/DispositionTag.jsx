import React from "react";

const tones = {
  urgent: { background: "var(--accent-bg)", color: "var(--accent)", border: "none" }, // needs attention
  active: { background: "var(--auto-bg)", color: "var(--auto-fg)", border: "none" }, // in progress / positive
  neutral: { background: "var(--surface-2)", color: "var(--ink-2)", border: "none" }, // quiet / informational
  praise: { background: "var(--praise-bg)", color: "var(--praise-fg)", border: "none" }, // praise
  error: { background: "var(--err-bg)", color: "var(--err-fg)", border: "none" }, // error (calm, not alarming)
  pending: { background: "transparent", color: "var(--pending-fg)", border: "1px dashed var(--pending-border)" }, // not started
};

/**
 * Uppercase mono tag for a row-level state. Six tones in the system's
 * abstract vocabulary. `pending` (dashed, unfilled) is the not-started
 * state — quieter than `neutral`.
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
