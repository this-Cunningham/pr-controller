import * as React from "react";

export interface ModeBadgeProps {
  mode: "safe" | "live";
  onToggle: () => void;
}

export function ModeBadge(props: ModeBadgeProps): JSX.Element;
