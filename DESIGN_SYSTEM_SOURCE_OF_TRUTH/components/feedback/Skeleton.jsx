import React from "react";

const shimmer = { background: "var(--surface-2)", borderRadius: 4, animation: "ws-shimmer 1.4s ease-in-out infinite" };
const card = (opacity) => ({
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-card)",
  padding: 20,
  opacity,
});

/**
 * First-fetch loading state — a caption and three fading placeholder
 * cards. Shown until the first poll resolves.
 */
export function Skeleton({ caption = "Fetching your open pull requests…", count = 3 }) {
  const opacities = [1, 0.8, 0.6];
  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-3)", marginBottom: 16 }}>
        {caption}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={card(opacities[i] ?? 0.5)}>
            <div style={{ ...shimmer, height: 11, width: 150 }} />
            <div style={{ ...shimmer, height: 16, width: i === 0 ? "62%" : "50%", marginTop: 13 }} />
            {i === 0 && <div style={{ ...shimmer, height: 46, width: "100%", marginTop: 15 }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
