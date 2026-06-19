import React from "react";
import { Callout } from "../core/Callout.jsx";
import { Button } from "../core/Button.jsx";
import { TextButton } from "../core/TextButton.jsx";
import { TerminalNote } from "../feedback/TerminalNote.jsx";

const surfaced = {
  background: "var(--accent-soft)",
  border: "1px solid var(--accent-bg)",
  borderRadius: "var(--radius-card)",
  padding: "12px 14px",
};
const ctaRow = { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 11, alignItems: "center" };
const mark = { color: "var(--accent)", fontSize: 12, lineHeight: 1.5, flex: "none" };
const line = { fontSize: 13, lineHeight: 1.5, color: "var(--ink)" };

/**
 * PR-level branch health, separate from per-thread actions. Three states
 * mirror the agent's auto-rebase flow:
 *   - "conflict": informational + pulsing — the agent is rebasing; no button (In progress).
 *   - "surfaced": the agent bailed on a risky rebase — Show details + Open in terminal (Needs you).
 *   - "outofsync": the branch diverged and the agent never ran — Resolve in terminal (Needs you).
 * There is no manual "rebase" button — rebasing is part of the agent's single run.
 */
export function BranchStatus({
  state,
  detail,
  details,
  detailsOpen = false,
  onToggleDetails,
  terminalOpen = false,
  onTerminal,
}) {
  if (state === "conflict") {
    return (
      <Callout tone="agent" dot pulse>
        {detail || "Resolving merge conflict — the agent is rebasing this; if it can’t resolve safely it’ll surface it for you."}
      </Callout>
    );
  }

  if (state === "surfaced") {
    return (
      <div style={surfaced}>
        <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
          <span style={mark}>◆</span>
          <div style={line}>{detail || "Rebase too risky to do automatically — open a terminal to continue."}</div>
        </div>
        {details && (
          <>
            <div style={{ marginTop: 9 }}>
              <TextButton tone="muted" underline={false} onClick={onToggleDetails}>↳ {detailsOpen ? "Hide details" : "Show details"}</TextButton>
            </div>
            {detailsOpen && (
              <div style={{ marginTop: 7, fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-2)", background: "var(--surface-2)", borderRadius: "var(--radius-card)", padding: "9px 11px" }}>{details}</div>
            )}
          </>
        )}
        <div style={ctaRow}>
          <Button variant="primary" onClick={onTerminal}>Open in terminal</Button>
          {terminalOpen && <TerminalNote>Terminal session opened…</TerminalNote>}
        </div>
      </div>
    );
  }

  // outofsync
  return (
    <div style={surfaced}>
      <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
        <span style={mark}>◆</span>
        <div style={line}>{detail || "Branch has diverged from remote — the agent hasn’t run on it."}</div>
      </div>
      <div style={ctaRow}>
        <Button variant="primary" onClick={onTerminal}>Resolve in terminal</Button>
        {terminalOpen && <TerminalNote>Terminal session opened…</TerminalNote>}
      </div>
    </div>
  );
}
