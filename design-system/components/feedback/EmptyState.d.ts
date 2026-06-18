import * as React from "react";

export interface EmptyStateProps {
  /** The reassuring line, e.g. "Nothing needs you right now." */
  label?: string;
}

export function EmptyState(props: EmptyStateProps): JSX.Element;
