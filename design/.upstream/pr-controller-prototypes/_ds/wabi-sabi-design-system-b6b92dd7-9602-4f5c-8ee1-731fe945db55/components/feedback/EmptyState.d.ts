import * as React from "react";

export interface EmptyStateProps {
  /** The reassuring line, e.g. "Nothing here right now." */
  label?: string;
}

export function EmptyState(props: EmptyStateProps): JSX.Element;
