import React from "react";
import { CALLOUT_TONES as tones } from "../../tokens/tones.js";

/**
 * Left-ruled status box. The system's workhorse for ambient status:
 * "agent surfaced a reason" (urgency), "agent working" (agent),
 * "suggested approach" / quoted replies (quiet). Optional eyebrow label
 * and a status dot that can pulse (use pulse for live/working states).
 */
export function Callout({ tone = "quiet", eyebrow, dot = false, pulse = false, children }) {
  const t = tones[tone] || tones.quiet;
  const hasHeader = eyebrow || dot;
  return (
    <div
      style={{
        background: t.bg,
        borderLeft: `3px solid ${t.rule}`,
        borderRadius: "0 var(--radius-card) var(--radius-card) 0",
        padding: "12px 14px",
      }}
    >
      {hasHeader && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: children ? 7 : 0 }}>
          {dot && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: t.mark,
                flex: "none",
                animation: pulse ? "ws-pulse 1.6s ease-in-out infinite" : "none",
              }}
            />
          )}
          {eyebrow && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "var(--tracking-eyebrow)",
                textTransform: "uppercase",
                color: t.mark,
              }}
            >
              {eyebrow}
            </span>
          )}
        </div>
      )}
      {children && <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink)" }}>{children}</div>}
    </div>
  );
}
