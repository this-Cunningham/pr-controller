import React from "react";
import styles from "./TerminalNote.module.css";

/**
 * Inline note marking that an interactive terminal session was opened.
 * Shows the `›_` prompt glyph in accent followed by the message.
 */
export function TerminalNote({ children = "Terminal session opened." }) {
  return (
    <div className={`${styles.note} ws-appear`}>
      <span className={styles.glyph}>›_</span>
      {children}
    </div>
  );
}
