import * as React from "react";

export interface ButtonProps {
  /** Visual weight. */
  variant?: "primary" | "outline" | "ghost";
  onClick?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

/**
 * @startingPoint section="Core" subtitle="Primary / outline / ghost button" viewport="320x80"
 */
export function Button(props: ButtonProps): JSX.Element;
