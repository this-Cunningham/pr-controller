import React from "react";
import { BADGE_TONES as tones } from "../../tokens/tones.js";

/**
 * Small status pill. Used for review status (Approved / Review required /
 * Draft) and PR signals (N auto-fixable, behind base, CI failing). The
 * `dot` adds a leading marker; `mono` renders uppercase tracked mono
 * (used for review-status pills).
 */
export function Badge({ tone = "neutral", dot = false, mono = false, children }) {
  const t = tones[tone] || tones.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: mono ? 11 : 11.5,
        letterSpacing: mono ? "0.06em" : "normal",
        textTransform: mono ? "uppercase" : "none",
        padding: mono ? "4px 9px" : "3px 9px",
        borderRadius: "var(--radius-chip)",
        background: t.background,
        color: t.color,
        border: `1px solid ${t.border}`,
      }}
    >
      {dot && (
        <span
          style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block" }}
        />
      )}
      {children}
    </span>
  );
}
