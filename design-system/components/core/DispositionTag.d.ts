import * as React from "react";

export interface DispositionTagProps {
  /**
   * accent = disagree/hash-out, sage = agree/auto-fix,
   * neutral = waiting, praise = praise, ochre = agent error,
   * pending = not yet judged by the agent (dashed, faintest).
   */
  tone?: "accent" | "sage" | "neutral" | "praise" | "ochre" | "pending";
  children?: React.ReactNode;
}

export function DispositionTag(props: DispositionTagProps): JSX.Element;
