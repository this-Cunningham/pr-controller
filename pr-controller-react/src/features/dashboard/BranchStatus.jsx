import React from "react";
import { AgentWorking } from "./AgentWorking.jsx";
import { Button } from "../../design-system/core/Button.jsx";
import { TextButton } from "../../design-system/core/TextButton.jsx";
import { TerminalNote } from "./TerminalNote.jsx";
import styles from "./BranchStatus.module.css";

/**
 * PR-level branch health, separate from per-thread actions. Generic by design — it
 * renders whatever branch state it's handed, so a new state is data, not new code:
 *   - tone="agent"     → the AgentWorking treatment (ripple loader, e.g. a rebase
 *                        running now).
 *   - tone="attention" → a boxed ◆ callout with optional "Show details" and action
 *                        buttons (e.g. Open in terminal, Rebase) — a "needs you" state.
 * `actions` is a list of { label, onClick, note?, variant? }; `variant:'text'` renders a
 * muted TextButton (a secondary action) instead of the default primary Button. `note`
 * renders after its button when truthy (e.g. the terminal hand-off marker).
 */
export function BranchStatus({
  tone = "attention",
  pulse = false,
  message,
  details,
  detailsOpen = false,
  onToggleDetails,
  actions = [],
}) {
  if (tone === "agent") {
    return <AgentWorking>{message}</AgentWorking>;
  }

  return (
    <div className={styles.box}>
      <div className={styles.head}>
        <span className={styles.mark}>◆</span>
        <div className={styles.line}>{message}</div>
      </div>
      {details && (
        <>
          <div className={styles.detailsToggle}>
            <TextButton tone="muted" underline={false} onClick={onToggleDetails}>↳ {detailsOpen ? "Hide details" : "Show details"}</TextButton>
          </div>
          {detailsOpen && <div className={`${styles.details} ws-appear`}>{details}</div>}
        </>
      )}
      {actions.length > 0 && (
        <div className={styles.ctaRow}>
          {actions.map((a, i) => (
            <React.Fragment key={i}>
              {a.variant === "text"
                ? <TextButton tone="muted" onClick={a.onClick}>{a.label}</TextButton>
                : <Button variant="primary" onClick={a.onClick}>{a.label}</Button>}
              {a.note && <TerminalNote>{a.note}</TerminalNote>}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
