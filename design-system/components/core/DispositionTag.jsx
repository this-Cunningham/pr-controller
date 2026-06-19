import React from "react";
import { TAG_TONES as tones } from "../../tokens/tones.js";

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
