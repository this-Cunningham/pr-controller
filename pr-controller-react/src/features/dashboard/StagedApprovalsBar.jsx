import React from "react";
import { Button } from "../../design-system/core/Button.jsx";
import styles from "./StagedApprovalsBar.module.css";

/**
 * Per-PR cart action: fire ONE agent run that carries out every approach
 * you've staged (via a thread's "Approve approach"). Distinct from a
 * single thread action. Quiet — and disabled — when nothing is staged.
 */
export function StagedApprovalsBar({ count = 0, running = false, onRun }) {
  const none = count === 0;
  return (
    <div className={styles.bar}>
      <span className={styles.text}>
        {none ? (
          "No approaches staged yet."
        ) : running ? (
          <span className={styles.running}>
            <span className={styles.glyph}>›_</span>
            Agent run started — {count} staged item{count === 1 ? "" : "s"} queued.
          </span>
        ) : (
          <>
            <span className={styles.count}>
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
