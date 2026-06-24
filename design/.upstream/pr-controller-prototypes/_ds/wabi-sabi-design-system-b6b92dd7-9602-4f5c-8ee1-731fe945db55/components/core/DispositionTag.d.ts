import * as React from "react";

export interface DispositionTagProps {
  /**
   * Presentational tone in the system's abstract vocabulary. This chip
   * renders a tone + label only; the caller decides what each tag says.
   *   urgent  = needs attention (accent/seal) — the only attention tone
   *   active  = in progress / positive (sage)
   *   neutral = quiet / informational
   *   pending = not started (dashed, faintest)
   *   praise  = praise
   *   error   = error (calm ochre, not alarming)
   */
  tone?: "urgent" | "active" | "neutral" | "praise" | "error" | "pending";
  children?: React.ReactNode;
}

export function DispositionTag(props: DispositionTagProps): JSX.Element;
