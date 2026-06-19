import React from "react";
import styles from "./Toast.module.css";

/**
 * Transient bottom-center acknowledgment shown after an action.
 * Render it once near the root; pass the current message or null.
 * The host is responsible for clearing it on a timer.
 */
export function Toast({ message }) {
  if (!message) return null;
  return (
    <div className={`${styles.toast} ws-fadeup`}>
      <span className={styles.dot} />
      {message}
    </div>
  );
}
