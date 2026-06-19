import * as React from "react";

export interface TerminalNoteProps {
  /** The note text. Defaults to "Terminal session opened." */
  children?: React.ReactNode;
}

export function TerminalNote(props: TerminalNoteProps): JSX.Element;
