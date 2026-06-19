import * as React from "react";

export interface BranchStatusProps {
  /** Which branch-health state to render. */
  state: "out-of-sync" | "working" | "suggested";
  /** Branch name, rendered in mono. */
  branch?: string;
  /** Commits ahead / behind origin (out-of-sync). */
  ahead?: number;
  behind?: number;
  /** Override the default body copy. */
  detail?: React.ReactNode;
  /** The proposed approach (suggested state). */
  suggestion?: React.ReactNode;
  /** Show the "resolve in terminal" hand-off note (out-of-sync). */
  resolving?: boolean;
  /** Put the Rebase button in its in-flight label. */
  rebasing?: boolean;
  onRebase?: () => void;
  onResolveTerminal?: () => void;
  onApprove?: () => void;
}

/**
 * @startingPoint section="PR Controller" subtitle="Branch-health states & CTAs" viewport="600x150"
 */
export function BranchStatus(props: BranchStatusProps): JSX.Element;
