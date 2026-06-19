import React from "react";

/**
 * Calm empty state — an open ensō circle and an italic line.
 * Used when a section has nothing flagged.
 */
export function EmptyState({ label = "Nothing flagged." }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "24px 4px", color: "var(--ink-3)" }}>
      <span
        style={{
          width: 26,
          height: 26,
          border: "1.5px solid var(--line-2)",
          borderTopColor: "transparent",
          borderRadius: "50%",
          display: "inline-block",
          transform: "rotate(-20deg)",
        }}
      />
      <span style={{ fontSize: 13.5, fontStyle: "italic" }}>{label}</span>
    </div>
  );
}
