import * as React from "react";

export interface TextButtonProps {
  onClick?: () => void;
  /** accent (default) for affordances like Undo; muted for de-emphasized ones like Show more. */
  tone?: "accent" | "muted";
  /** Underline the label (default true). */
  underline?: boolean;
  children?: React.ReactNode;
}

export function TextButton(props: TextButtonProps): JSX.Element;
