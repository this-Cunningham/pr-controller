import * as React from "react";

export interface ScopeBadgeProps {
  /** "all" = watching every open PR; "scoped" = limited to an allowlist of `count`. */
  scope: "all" | "scoped";
  /** Number of allowlisted PRs (shown in the scoped state). */
  count?: number;
  onToggle: () => void;
  /** Label for the "all" state (default "Watching all PRs"). */
  allLabel?: string;
  /** Label for the scoped state (default "Scoped · {count} PRs"). */
  scopedLabel?: string;
}

export function ScopeBadge(props: ScopeBadgeProps): JSX.Element;
