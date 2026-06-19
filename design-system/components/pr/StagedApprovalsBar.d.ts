import * as React from "react";

export interface StagedApprovalsBarProps {
  /** How many approvals are staged and waiting to be applied. */
  count?: number;
  /** Put the button in its in-flight label and keep it busy. */
  running?: boolean;
  onRun?: () => void;
}

export function StagedApprovalsBar(props: StagedApprovalsBarProps): JSX.Element;
