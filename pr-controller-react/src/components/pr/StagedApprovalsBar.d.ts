import * as React from "react";

export interface StagedApprovalsBarProps {
  /** How many approaches are staged in this PR's cart. */
  count?: number;
  /** Show the "agent run started" state instead of the Run button. */
  running?: boolean;
  onRun?: () => void;
}

export function StagedApprovalsBar(props: StagedApprovalsBarProps): JSX.Element;
