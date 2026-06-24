import React from "react";

/**
 * Inline confirmation line shown after an action resolves, with an
 * optional Undo affordance.
 */
export function Confirmation({ text, fg = "var(--ink-2)", onUndo }) {
  const [h, setH] = React.useState(false);
  return (
    <div style={{ marginTop: 11, display: "flex", alignItems: "center", gap: 10, animation: "ws-appear var(--dur-card) var(--ease)" }}>
      <span style={{ fontSize: 12.5, color: fg }}>{text}</span>
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          onMouseEnter={() => setH(true)}
          onMouseLeave={() => setH(false)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            font: "12.5px var(--font-sans)",
            color: "var(--accent)",
            textDecoration: "underline",
            cursor: "pointer",
            opacity: h ? 0.7 : 1,
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}
