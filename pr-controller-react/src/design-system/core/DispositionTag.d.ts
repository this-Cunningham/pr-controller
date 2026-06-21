import * as React from "react";

export interface DispositionTagProps {
  /**
   * Tone ↔ disposition is fixed:
   *   urgent  = needs your input (the only "needs you" tag)
   *   active  = agent fixed · waiting on reviewer
   *   neutral = waiting on reviewer (you replied; ball is the reviewer's)
   *   pending = no feedback yet (dashed, faintest — agent hasn't judged it)
   *   praise  = praise
   *   error   = agent error
   */
  tone?: "urgent" | "active" | "neutral" | "praise" | "error" | "pending";
  children?: React.ReactNode;
}

export function DispositionTag(props: DispositionTagProps): JSX.Element;
