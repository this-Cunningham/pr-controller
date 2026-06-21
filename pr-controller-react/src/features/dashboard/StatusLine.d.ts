import * as React from "react";

export interface StatusLineProps {
  /**
   * Dot alignment relative to the text. "center" (default) for short
   * single-line copy (agent working); "top" for longer copy that wraps
   * (rebasing a conflict), pinning the dot to the first line.
   */
  align?: "center" | "top";
  /** Tints the whole line: "agent" (sage, default), "accent" (persimmon), or "ochre" (warm amber/brown). */
  tone?: "agent" | "accent" | "ochre";
  /** Whether the dot pulses (live state). Defaults to true. */
  pulse?: boolean;
  /** The status text. */
  children?: React.ReactNode;
}

export function StatusLine(props: StatusLineProps): JSX.Element;
