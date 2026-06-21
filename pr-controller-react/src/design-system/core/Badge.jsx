import React from "react";
import styles from "./Badge.module.css";

const TONES = ["neutral", "active", "urgent", "praise", "outline"];

/**
 * Small status pill. Used for review status (Approved / Review required /
 * Draft) and PR signals (behind base, CI failing). `dot` adds a leading
 * marker; `mono` renders uppercase tracked mono (review-status pills).
 */
export function Badge({ tone = "neutral", dot = false, mono = false, children }) {
  const t = TONES.includes(tone) ? tone : "neutral";
  return (
    <span className={styles.badge} data-tone={t} data-mono={mono || undefined}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  );
}
