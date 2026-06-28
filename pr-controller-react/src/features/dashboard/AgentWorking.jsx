import React from "react";
import { Callout } from "../../design-system/core/Callout.jsx";
import { OrganicLoader } from "../../design-system/feedback/OrganicLoader.jsx";
import styles from "./AgentWorking.module.css";

/**
 * The single home for the "agent is live on this PR" semantic: a Callout in the
 * active (sage) tone wrapping a `scan` OrganicLoader (a watching-eye blob — reads as
 * something with intelligence behind it) + one line of copy. Used for both the
 * ambient "agent working" row and a merge conflict the agent is rebasing right now.
 * The loader self-staggers per instance, so stacked cards desync. It's decorative
 * (aria-hidden) — the copy carries the meaning.
 */
export function AgentWorking({ children }) {
  return (
    <Callout tone="active">
      <span className={styles.row}>
        <OrganicLoader variant="scan" size={40} aria-hidden="true" className={styles.loader} />
        <span className={styles.text}>{children}</span>
      </span>
    </Callout>
  );
}
