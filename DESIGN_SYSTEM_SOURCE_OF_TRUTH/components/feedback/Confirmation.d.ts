import * as React from "react";

export interface ConfirmationProps {
  /** The acknowledgment text (often prefixed with ✓). */
  text: string;
  /** Text color; use var(--auto-fg) for positive outcomes. */
  fg?: string;
  /** If provided, renders an Undo link. */
  onUndo?: () => void;
}

export function Confirmation(props: ConfirmationProps): JSX.Element;
