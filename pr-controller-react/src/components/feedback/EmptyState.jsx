import React from "react";
import styles from "./EmptyState.module.css";

/**
 * Calm empty state — an open ensō circle and an italic line.
 * Used when a section has nothing flagged.
 */
export function EmptyState({ label = "Nothing flagged." }) {
  return (
    <div className={styles.row}>
      <span className={styles.enso} />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
