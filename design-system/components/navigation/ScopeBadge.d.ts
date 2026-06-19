import * as React from "react";

export interface ScopeBadgeProps {
  /** "all" = watching every open PR; "scoped" = limited to an allowlist of `count`. */
  scope: "all" | "scoped";
  /** Number of allowlisted PRs (shown in the scoped state). */
  count?: number;
  onToggle: () => void;
}

export function ScopeBadge(props: ScopeBadgeProps): JSX.Element;
