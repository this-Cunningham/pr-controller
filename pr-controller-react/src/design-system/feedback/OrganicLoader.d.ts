import * as React from "react";

export type OrganicLoaderVariant =
  | "enso"
  | "ripple"
  | "seal"
  | "brush"
  | "motes"
  | "reeds"
  | "kintsugi"
  | "stones"
  | "seeker"
  | "diviner"
  | "swarm"
  | "vigil"
  | "wisp"
  | "sentinel"
  | "drowse"
  | "scan"
  | "saccade"
  | "comet"
  | "veil";

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
  /**
   * Phase offset into the (long) animation loop, 0–1. Each instance is
   * auto-randomized on mount so identical loaders on a page drift out of sync
   * rather than blinking in unison — pass an explicit value only when you want
   * deterministic, repeatable offsets. Ignored under prefers-reduced-motion.
   */
  phase?: number;
}

export function OrganicLoader(props: OrganicLoaderProps): JSX.Element;
