import * as React from "react";

export interface BadgeProps {
  /**
   * Tonal treatment, in the system's abstract vocabulary:
   *   neutral = quiet / informational (default)
   *   active  = in-progress / positive (sage)
   *   urgent  = needs attention (accent/seal) — use sparingly
   *   praise  = positive feedback
   *   outline = de-emphasized / draft (hairline border, no fill)
   */
  tone?: "neutral" | "active" | "urgent" | "praise" | "outline";
  /** Leading dot marker. */
  dot?: boolean;
  /** Uppercase tracked mono (status pills). */
  mono?: boolean;
  children?: React.ReactNode;
}

export function Badge(props: BadgeProps): JSX.Element;
