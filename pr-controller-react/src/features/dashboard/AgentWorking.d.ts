import * as React from "react";

export interface AgentWorkingProps {
  /** The status line shown beside the scan loader. */
  children?: React.ReactNode;
}

export function AgentWorking(props: AgentWorkingProps): JSX.Element;
