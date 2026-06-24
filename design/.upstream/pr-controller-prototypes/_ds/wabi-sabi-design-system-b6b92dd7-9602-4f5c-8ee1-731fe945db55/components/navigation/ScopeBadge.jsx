import React from "react";

/**
 * Two-state scope toggle showing whether a view covers everything or a
 * scoped subset. "all" is calm (sage dot); "scoped"
 * uses the accent with a hollow ring to flag that some items are
 * deliberately out of view. Click toggles. Labels are overridable.
 */
export function ScopeBadge({
  scope,
  count = 0,
  onToggle,
  allLabel = "All",
  scopedLabel,
}) {
  const scoped = scope === "scoped";
  const scopedText = scopedLabel || `Scoped · ${count}`;
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
    >
      {scoped ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "5px 12px",
            borderRadius: "var(--radius-round)",
            background: "var(--accent-bg)",
            color: "var(--accent)",
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid var(--accent)" }} />
          {scopedText}
        </span>
      ) : (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "5px 12px",
            borderRadius: "var(--radius-round)",
            background: "var(--surface-2)",
            color: "var(--ink-2)",
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--auto-fg)" }} />
          {allLabel}
        </span>
      )}
    </button>
  );
}
