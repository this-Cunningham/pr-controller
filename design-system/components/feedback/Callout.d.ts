import * as React from "react";

export interface CalloutProps {
  /** Visual tone: accent (urgency), sage (agent/auto), neutral (quiet quote). */
  tone?: "accent" | "sage" | "neutral";
  /** Uppercase-mono eyebrow label (e.g. "Agent surfaced"). */
  label?: string;
  /** Render a leading status dot in the tone color. */
  dot?: boolean;
  /** Pulse the dot (ambient "working" motion). Only meaningful with `dot`. */
  pulse?: boolean;
  /** Body content. Omit for a dot+label-only strip (e.g. "Agent working"). */
  children?: React.ReactNode;
}

export function Callout(props: CalloutProps): JSX.Element;
