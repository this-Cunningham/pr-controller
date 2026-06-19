import React from "react";
import styles from "./Confirmation.module.css";

/**
 * Inline confirmation line shown after a thread action resolves,
 * with an optional Undo affordance.
 */
export function Confirmation({ text, fg = "var(--ink-2)", onUndo }) {
  return (
    <div className={`${styles.row} ws-appear`}>
      <span className={styles.text} style={{ color: fg }}>{text}</span>
      {onUndo && (
        <button type="button" className={styles.undo} onClick={onUndo}>
          Undo
        </button>
      )}
    </div>
  );
}
