import * as React from "react";
import type { PRController } from "./ThreadRow";

export interface JiraBannerProps {
  /** The PR this banner belongs to (needs `id`). */
  pr: { id: string };
  controller: PRController;
}

export function JiraBanner(props: JiraBannerProps): JSX.Element;
