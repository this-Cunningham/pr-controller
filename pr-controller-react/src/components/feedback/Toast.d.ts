import * as React from "react";

export interface ToastProps {
  /** Message to show; pass null/empty to render nothing. */
  message?: string | null;
}

export function Toast(props: ToastProps): JSX.Element | null;
