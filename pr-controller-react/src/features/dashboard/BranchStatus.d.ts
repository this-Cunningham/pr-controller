import * as React from "react";

export interface BranchAction {
  label: string;
  onClick: () => void;
  /** Optional note rendered after the button when truthy (e.g. a terminal hand-off). */
  note?: React.ReactNode;
}

export interface BranchStatusProps {
  /** 'agent' = ambient pulsing status line; 'attention' = boxed ◆ callout with actions. */
  tone?: "agent" | "attention";
  /** Pulse the status dot (for the ambient 'agent' tone). */
  pulse?: boolean;
  /** One-line body copy. */
  message?: React.ReactNode;
  /** Full reason, revealed by "Show details" (attention tone). */
  details?: React.ReactNode;
  detailsOpen?: boolean;
  onToggleDetails?: () => void;
  /** Action buttons (attention tone). */
  actions?: BranchAction[];
}

/**
 * @startingPoint section="PR Controller" subtitle="Branch-health states & CTAs" viewport="600x150"
 */
export function BranchStatus(props: BranchStatusProps): JSX.Element;
