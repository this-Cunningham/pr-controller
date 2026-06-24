import React from "react";

/**
 * Transient bottom-center acknowledgment shown after an action.
 * Render it once near the root; pass the current message or null.
 * The host is responsible for clearing it on a timer.
 */
export function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 28,
        transform: "translateX(-50%)",
        background: "var(--ink)",
        color: "var(--bg)",
        fontSize: 13,
        padding: "11px 17px",
        borderRadius: "var(--radius-toast)",
        display: "flex",
        alignItems: "center",
        gap: 9,
        boxShadow: "var(--shadow-toast)",
        animation: "ws-fadeup var(--dur-fast) var(--ease)",
        zIndex: 50,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />
      {message}
    </div>
  );
}
