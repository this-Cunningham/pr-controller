import * as React from "react";

export interface DispositionTagProps {
  /**
   * accent = disagree/hash-out, sage = agree/auto-fix,
   * neutral = waiting, praise = praise, ochre = agent error.
   */
  tone?: "accent" | "sage" | "neutral" | "praise" | "ochre";
  children?: React.ReactNode;
}

export function DispositionTag(props: DispositionTagProps): JSX.Element;
