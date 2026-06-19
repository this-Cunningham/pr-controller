import React from "react";
import styles from "./ScopeBadge.module.css";

/**
 * Header scope badge. The agent ALWAYS acts for real — this only shows
 * WHICH PRs it watches, never whether it acts. "all" = every open PR
 * (calm, sage dot); "scoped" = an allowlist of N PRs (accent, hollow
 * ring) to flag that some PRs are deliberately out of view. Click toggles.
 */
export function ScopeBadge({ scope, count = 0, onToggle }) {
  const key = scope === "scoped" ? "scoped" : "all";
  return (
    <button
      type="button"
      className={styles.btn}
      onClick={onToggle}
      title="The agent always acts for real — this only changes which PRs it watches."
    >
      <span className={styles.pill} data-scope={key}>
        <span className={styles.dot} data-scope={key} />
        {key === "scoped" ? `Scoped · ${count} PRs` : "Watching all PRs"}
      </span>
    </button>
  );
}
