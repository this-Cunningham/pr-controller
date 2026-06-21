import * as React from "react";

export interface JiraBannerProps {
  /** The linked ticket key, or null when none is set yet. */
  linked: string | null;
  /** Set the PR's ticket. Return false to reject (e.g. empty/invalid). */
  onSetTicket(value: string): boolean | void;
}

export function JiraBanner(props: JiraBannerProps): JSX.Element;
