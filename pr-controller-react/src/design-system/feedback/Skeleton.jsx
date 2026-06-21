import React from "react";
import { OrganicLoader } from "./OrganicLoader.jsx";
import styles from "./Skeleton.module.css";

/**
 * First-fetch loading state — a quiet ensō loader + caption and three fading
 * placeholder cards. Shown until the first poll resolves.
 */
export function Skeleton({ caption = "Fetching your open pull requests…", count = 3 }) {
  const opacities = [1, 0.8, 0.6];
  return (
    <div className={styles.wrap}>
      <div className={styles.captionRow}>
        <OrganicLoader variant="enso" size={18} aria-hidden="true" className={styles.loader} />
        <span className={styles.caption}>{caption}</span>
      </div>
      <div className={styles.cards}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={styles.card} style={{ opacity: opacities[i] ?? 0.5 }}>
            <div className={`${styles.bar} ws-shimmer`} style={{ height: 11, width: 150 }} />
            <div className={`${styles.bar} ws-shimmer`} style={{ height: 16, width: i === 0 ? "62%" : "50%", marginTop: 13 }} />
            {i === 0 && <div className={`${styles.bar} ws-shimmer`} style={{ height: 46, width: "100%", marginTop: 15 }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
