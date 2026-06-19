import React from "react";
import styles from "./Tabs.module.css";

/**
 * Sticky section tabs with count chips. The active tab carries an
 * accent underline; a tab can `emphasize` its count (accent chip) to
 * flag attention (e.g. "Needs you").
 */
export function Tabs({ tabs, active, onChange, sticky = true }) {
  return (
    <div className={styles.bar} data-sticky={sticky ? "true" : "false"}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const accentChip = tab.emphasize && tab.count > 0;
        return (
          <button
            key={tab.key}
            type="button"
            className={styles.tab}
            data-active={isActive ? "true" : undefined}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span className={styles.chip} data-accent={accentChip ? "true" : undefined}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
