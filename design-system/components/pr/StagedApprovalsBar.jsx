import React from "react";
import { Button } from "../core/Button.jsx";

/**
 * PR-level CTA bar: run the agent against the changes you've staged by
 * approving them. Distinct from a single thread's Approve — this applies
 * the whole batch. Quiet when count is 0.
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
          "No staged approvals yet."
        ) : (
          <>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>
              {count} approval{count === 1 ? "" : "s"} staged
            </span>{" "}
            — ready to apply.
          </>
        )}
      </span>
      <Button variant="primary" onClick={onRun} disabled={none}>
        {running ? "Running…" : "Run agent"}
      </Button>
    </div>
  );
}
