import React from "react";
import { Button } from "../core/Button.jsx";

/**
 * Per-PR cart action: fire ONE agent run that carries out every approach
 * you've staged (via a thread's "Approve approach"). Distinct from a
 * single thread action. Quiet — and disabled — when nothing is staged.
 */
export function StagedApprovalsBar({ count = 0, running = false, onRun }) {
  const none = count === 0;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-card)",
        padding: "12px 14px",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
        {none ? (
          "No approaches staged yet."
        ) : running ? (
          <span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>›_</span>
            Agent run started — {count} staged item{count === 1 ? "" : "s"} queued.
          </span>
        ) : (
          <>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>
              {count} approach{count === 1 ? "" : "es"} staged
            </span>{" "}
            for this PR.
          </>
        )}
      </span>
      {!running && (
        <Button variant="primary" onClick={onRun} disabled={none}>
          Run agent ({count})
        </Button>
      )}
    </div>
  );
}
