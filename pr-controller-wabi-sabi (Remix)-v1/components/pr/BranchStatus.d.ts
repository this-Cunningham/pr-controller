import * as React from "react";

export interface BranchStatusProps {
  /** Which branch-health state to render. */
  state: "conflict" | "surfaced" | "outofsync";
  /** Override the default one-line body copy. */
  detail?: React.ReactNode;
  /** Full reason behind a surfaced rebase, revealed by "Show details". */
  details?: React.ReactNode;
  detailsOpen?: boolean;
  onToggleDetails?: () => void;
  /** Show the terminal hand-off note after the CTA is clicked. */
  terminalOpen?: boolean;
  onTerminal?: () => void;
}

/**
 * @startingPoint section="PR Controller" subtitle="Branch-health states & CTAs" viewport="600x150"
 */
export function BranchStatus(props: BranchStatusProps): JSX.Element;
