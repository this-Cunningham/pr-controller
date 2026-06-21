import * as React from "react";

export type OrganicLoaderVariant =
  | "enso"
  | "ripple"
  | "seal"
  | "brush"
  | "motes"
  | "reeds"
  | "kintsugi"
  | "stones";

export const ORGANIC_LOADER_VARIANTS: OrganicLoaderVariant[];

export interface OrganicLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Which glyph to draw. Defaults to "enso". */
  variant?: OrganicLoaderVariant;
  /** Optional caption rendered beneath the glyph (also used as the aria-label). */
  label?: string;
  /** Raw tone override by token name (e.g. "ink-2" | "auto-fg" | "accent").
      Omit to use the variant's intrinsic default. */
  tone?: string;
  /** Shrink the glyph into a fixed square slot (px) for compact / inline use. */
  size?: number;
}

export function OrganicLoader(props: OrganicLoaderProps): JSX.Element;
