import React from "react";
import styles from "./TextButton.module.css";

/**
 * Quiet inline text button for low-stakes actions (Show more, Undo).
 * No fill, no border — just colored text. `tone` accent (default) or
 * muted (ink-2). Underlined by default.
 */
export function TextButton({ onClick, tone = "accent", underline = true, children }) {
  return (
    <button
      type="button"
      className={styles.btn}
      data-tone={tone === "muted" ? "muted" : "accent"}
      data-underline={underline ? "true" : "false"}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
