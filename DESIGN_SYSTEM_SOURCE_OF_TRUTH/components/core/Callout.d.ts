import * as React from "react";

export interface CalloutProps {
  /** urgency = accent (needs attention), agent = sage (auto/working), quiet = neutral. */
  tone?: "urgency" | "agent" | "quiet";
  /** Uppercase mono label above the body. */
  eyebrow?: React.ReactNode;
  /** Show a leading status dot in the header. */
  dot?: boolean;
  /** Pulse the dot (for live / "agent working" states). */
  pulse?: boolean;
  children?: React.ReactNode;
}

/**
 * @startingPoint section="Core" subtitle="Left-ruled status callout" viewport="420x120"
 */
export function Callout(props: CalloutProps): JSX.Element;
