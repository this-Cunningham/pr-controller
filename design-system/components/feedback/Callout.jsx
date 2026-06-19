import React from "react";

// Tone → the left rule + tinted ground + eyebrow color. Body text is --ink-2.
const tones = {
  accent: { rule: "var(--accent)", bg: "var(--accent-bg)", eyebrow: "var(--accent)" },  // urgency / surfaced
  sage: { rule: "var(--auto-fg)", bg: "var(--auto-bg)", eyebrow: "var(--auto-fg)" },     // agent / auto / proposed
  neutral: { rule: "var(--line-2)", bg: "var(--surface-2)", eyebrow: "var(--ink-2)" },   // quiet quote (e.g. your rebuttal)
};

/**
 * A left-ruled callout: a tinted box with a hairline accent rule down the left
 * edge, an optional uppercase-mono eyebrow, an optional (optionally pulsing)
 * status dot, and a body. The recurring "the agent surfaced / is working /
 * proposes…" and quoted-reply blocks on PR cards and threads.
 *
 * Layout: with a dot and no body the eyebrow sits inline beside the dot;
 * otherwise the eyebrow is a block above the body.
 */
export function Callout({ tone = "accent", label, dot = false, pulse = false, children }) {
  const t = tones[tone] || tones.accent;
  const inline = dot && !children; // dot + label only (e.g. "● Agent working")
  return (
    <div
      style={{
        marginTop: 12,
        background: t.bg,
        borderLeft: `2px solid ${t.rule}`,
        padding: "10px 13px",
        borderRadius: "0 var(--radius-card) var(--radius-card) 0",
        fontSize: 13,
        lineHeight: 1.5,
        color: "var(--ink)",
        ...(inline ? { display: "flex", alignItems: "center", gap: 8 } : null),
      }}
    >
      {dot && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: t.rule,
            ...(pulse ? { animation: "ws-pulse 1.6s ease-in-out infinite" } : null),
          }}
        />
      )}
      {label && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: t.eyebrow, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
      )}
      {children != null && (
        <div style={label ? { marginTop: 5, color: "var(--ink-2)" } : { color: "var(--ink-2)" }}>{children}</div>
      )}
    </div>
  );
}
