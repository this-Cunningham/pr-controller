import React from "react";

/**
 * Sticky section tabs with count chips. The active tab carries an
 * accent underline; a tab can `emphasize` its count (accent chip) to
 * flag attention.
 */
export function Tabs({ tabs, active, onChange, sticky = true }) {
  const [hover, setHover] = React.useState(null);
  return (
    <div
      style={{
        position: sticky ? "sticky" : "static",
        top: 0,
        zIndex: 20,
        background: "var(--bg)",
        display: "flex",
        flexWrap: "wrap",
        borderBottom: "1px solid var(--line)",
        marginTop: 6,
        paddingTop: 8,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const accentChip = tab.emphasize && tab.count > 0;
        const color = isActive || hover === tab.key ? "var(--ink)" : "var(--ink-2)";
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            onMouseEnter={() => setHover(tab.key)}
            onMouseLeave={() => setHover(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "14px 0",
              marginRight: 26,
              marginBottom: -1,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              font: "600 14.5px var(--font-sans)",
              color,
              borderBottom: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
            }}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span
                style={{
                  font: "500 11.5px var(--font-mono)",
                  padding: "1px 8px",
                  borderRadius: "var(--radius-round)",
                  background: accentChip ? "var(--accent-bg)" : "var(--surface-2)",
                  color: accentChip ? "var(--accent)" : "var(--ink-2)",
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
