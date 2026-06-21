import React from "react";
import styles from "./Callout.module.css";

const TONES = ["urgent", "active", "neutral"];

/**
 * Left-ruled status box. The system's workhorse for ambient status:
 * "agent surfaced a reason" (urgent), "agent working" (active),
 * "suggested approach" / quoted replies (neutral). Optional eyebrow label
 * and a status dot that can pulse (use pulse for live/working states).
 */
export function Callout({ tone = "neutral", eyebrow, dot = false, pulse = false, children }) {
  const t = TONES.includes(tone) ? tone : "neutral";
  const hasHeader = eyebrow || dot;
  return (
    <div className={styles.callout} data-tone={t}>
      {hasHeader && (
        <div className={styles.header} data-spaced={children ? "true" : undefined}>
          {dot && <span className={`${styles.dot}${pulse ? " ws-pulse" : ""}`} />}
          {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        </div>
      )}
      {children && <div className={styles.body}>{children}</div>}
    </div>
  );
}
