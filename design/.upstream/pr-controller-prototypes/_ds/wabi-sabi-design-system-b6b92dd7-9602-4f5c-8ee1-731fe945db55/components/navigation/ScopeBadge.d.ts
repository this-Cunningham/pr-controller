import * as React from "react";

export interface ScopeBadgeProps {
  /** "all" = covering everything; "scoped" = limited to a subset of `count`. */
  scope: "all" | "scoped";
  /** Number of items in the scoped subset (shown in the scoped state). */
  count?: number;
  onToggle: () => void;
  /** Label for the "all" state (default "All"). */
  allLabel?: string;
  /** Label for the scoped state (default "Scoped · {count}"). */
  scopedLabel?: string;
}

export function ScopeBadge(props: ScopeBadgeProps): JSX.Element;
