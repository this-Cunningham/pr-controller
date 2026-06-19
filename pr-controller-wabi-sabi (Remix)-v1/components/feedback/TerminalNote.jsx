import React from "react";

/**
 * Inline note marking that an interactive terminal session was opened.
 * Shows the `›_` prompt glyph in accent followed by the message.
 */
export function TerminalNote({ children = "Terminal session opened." }) {
  return (
    <div
      style={{
        marginTop: 11,
        fontSize: 12.5,
        color: "var(--ink-2)",
        display: "flex",
        gap: 7,
        alignItems: "center",
        animation: "ws-appear .3s ease",
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>›_</span>
      {children}
    </div>
  );
}
