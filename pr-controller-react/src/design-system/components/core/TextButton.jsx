import React from "react";

/**
 * Quiet inline text button for low-stakes actions (Show more, Undo).
 * No fill, no border — just colored text. `tone` accent (default) or
 * muted (ink-2). Underlined by default.
 */
export function TextButton({ onClick, tone = "accent", underline = true, children }) {
  const [h, setH] = React.useState(false);
  const color = tone === "muted" ? "var(--ink-2)" : "var(--accent)";
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        font: "12.5px var(--font-sans)",
        color,
        textDecoration: underline ? "underline" : "none",
        textUnderlineOffset: 2,
        cursor: "pointer",
        opacity: h ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}
