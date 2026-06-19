import React from "react";
import styles from "./DispositionTag.module.css";

const TONES = ["accent", "sage", "neutral", "praise", "ochre", "pending"];

/**
 * Uppercase mono disposition tag for a reviewer thread. Six tones map
 * to the agent's classification (via data-tone). `pending` (dashed,
 * unfilled) is the agent-hasn't-judged-yet state — quieter than
 * `neutral` (waiting).
 */
export function DispositionTag({ tone = "neutral", children }) {
  const t = TONES.includes(tone) ? tone : "neutral";
  return (
    <span className={styles.tag} data-tone={t}>
      {children}
    </span>
  );
}
