import * as React from "react";

export interface CalloutProps {
  /**
   * Tone, in the system's abstract vocabulary:
   *   urgent  = accent/seal (needs attention)
   *   active  = sage (in progress / positive)
   *   neutral = quiet informational (default)
   */
  tone?: "urgent" | "active" | "neutral";
  /** Uppercase mono label above the body. */
  eyebrow?: React.ReactNode;
  /** Show a leading status dot in the header. */
  dot?: boolean;
  /** Pulse the dot (for live states). */
  pulse?: boolean;
  children?: React.ReactNode;
}

/**
 * @startingPoint section="Core" subtitle="Left-ruled status callout" viewport="420x120"
 */
export function Callout(props: CalloutProps): JSX.Element;
