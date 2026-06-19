import * as React from "react";

export interface DispositionTagProps {
  /**
   * Tone ↔ disposition is fixed:
   *   accent  = needs your input (the only "needs you" tag)
   *   sage    = agent fixed · waiting on reviewer
   *   neutral = waiting on reviewer (you replied; ball is the reviewer's)
   *   pending = no feedback yet (dashed, faintest — agent hasn't judged it)
   *   praise  = praise
   *   ochre   = agent error
   */
  tone?: "accent" | "sage" | "neutral" | "praise" | "ochre" | "pending";
  children?: React.ReactNode;
}

export function DispositionTag(props: DispositionTagProps): JSX.Element;
