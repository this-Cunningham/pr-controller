import React from "react";

/**
 * Inline terminal hand-off note. The `›_` glyph (the sanctioned terminal mark)
 * + a line of text, animating in via ws-appear. Shown when an interactive
 * terminal session is opened for a thread or a surfaced branch-health blocker.
 *
 * Extracted from the design system's ThreadRow (where it was an inline helper)
 * so it's a shared component instead of being re-implemented per consumer.
 */
export function TerminalNote({ children }) {
  return (
    <div style={{ marginTop: 11, fontSize: 12.5, color: "var(--ink-2)", display: "flex", gap: 7, alignItems: "center", animation: "ws-appear .3s ease" }}>
      <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>›_</span>
      {children}
    </div>
  );
}
