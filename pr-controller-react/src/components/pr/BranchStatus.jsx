import React from "react";
import { StatusLine } from "../feedback/StatusLine.jsx";
import { Button } from "../core/Button.jsx";
import { TextButton } from "../core/TextButton.jsx";
import { TerminalNote } from "../feedback/TerminalNote.jsx";
import styles from "./BranchStatus.module.css";

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
      <StatusLine align="top">
        {detail || "Resolving merge conflict — the agent is rebasing this; if it can’t resolve safely it’ll surface it for you."}
      </StatusLine>
    );
  }

  if (state === "surfaced") {
    return (
      <div className={styles.box}>
        <div className={styles.head}>
          <span className={styles.mark}>◆</span>
          <div className={styles.line}>{detail || "Rebase too risky to do automatically — open a terminal to continue."}</div>
        </div>
        {details && (
          <>
            <div className={styles.detailsToggle}>
              <TextButton tone="muted" underline={false} onClick={onToggleDetails}>↳ {detailsOpen ? "Hide details" : "Show details"}</TextButton>
            </div>
            {detailsOpen && <div className={`${styles.details} ws-appear`}>{details}</div>}
          </>
        )}
        <div className={styles.ctaRow}>
          <Button variant="primary" onClick={onTerminal}>Open in terminal</Button>
          {terminalOpen && <TerminalNote>Terminal session opened…</TerminalNote>}
        </div>
      </div>
    );
  }

  // outofsync
  return (
    <div className={styles.box}>
      <div className={styles.head}>
        <span className={styles.mark}>◆</span>
        <div className={styles.line}>{detail || "Branch has diverged from remote — the agent hasn’t run on it."}</div>
      </div>
      <div className={styles.ctaRow}>
        <Button variant="primary" onClick={onTerminal}>Resolve in terminal</Button>
        {terminalOpen && <TerminalNote>Terminal session opened…</TerminalNote>}
      </div>
    </div>
  );
}
