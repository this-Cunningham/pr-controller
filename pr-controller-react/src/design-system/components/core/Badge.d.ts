import * as React from "react";

export interface BadgeProps {
  /** Tonal treatment. `outline` is used for the Draft review pill. */
  tone?: "neutral" | "sage" | "accent" | "praise" | "outline";
  /** Leading dot marker (rarely needed for signal pills). */
  dot?: boolean;
  /** Uppercase tracked mono (review-status pills). */
  mono?: boolean;
  children?: React.ReactNode;
}

export function Badge(props: BadgeProps): JSX.Element;
