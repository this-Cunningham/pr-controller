import * as React from "react";

export interface SkeletonProps {
  /** Loading caption. */
  caption?: string;
  /** Placeholder card count (default 3). */
  count?: number;
}

export function Skeleton(props: SkeletonProps): JSX.Element;
