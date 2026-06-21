import React from "react";
import styles from "./StatusLine.module.css";

/**
 * Inline live-status row: a pulsing dot + one line of text on a tinted
 * ground. Distinct from Callout (a left-ruled header/body box). Used for
 * ambient agent states:
 *   - agent working — short copy, dot centered with the text (align="center")
 *   - rebasing a conflict — longer copy that wraps, dot pinned to the first
 *     line (align="top")
 * `tone` tints the whole line: "agent" (sage, default), "accent"
 * (persimmon), or "ochre" (warm amber/brown) for paused / warning states.
 */
const TONES = ["agent", "accent", "ochre"];
export function StatusLine({ align = "center", tone = "agent", pulse = true, children }) {
  return (
    <div className={styles.line} data-align={align === "top" ? "top" : "center"} data-tone={TONES.includes(tone) ? tone : "agent"}>
      <span className={`${styles.dot}${pulse ? " ws-pulse" : ""}`} />
      <span>{children}</span>
    </div>
  );
}
