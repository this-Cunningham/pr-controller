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

/** Token names the loader may be tinted with. */
export type OrganicLoaderTone = "ink-2" | "auto-fg" | "accent";

export interface OrganicLoaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Which organic motion to draw. Default `"enso"`. */
  variant?: OrganicLoaderVariant;
  /** Optional caption shown beneath the glyph (mono, ink-3). */
  label?: string;
  /**
   * Render the glyph at a fixed square size in px (scaled down from its
   * intrinsic size) for compact/inline use — e.g. a leading mark in a
   * status line. Omit for the full centerpiece size. Best for the square
   * variants; `brush`/`kintsugi` are meant to be shown at full width.
   */
  size?: number;
  /**
   * Phase offset into the (long) animation loop, 0–1. Each instance is
   * auto-randomized on mount so identical loaders on a page drift out of
   * sync rather than blinking in unison — pass an explicit value only when
   * you want deterministic, repeatable offsets. Ignored under
   * prefers-reduced-motion.
   */
  phase?: number;
  /**
   * Override the glyph color. Each variant has a semantically correct
   * default (sage for active, accent for urgent, ink for neutral) — set
   * this only when context demands a different tone.
   */
  tone?: OrganicLoaderTone;
}

/** The ordered list of every variant, for galleries/storybooks. */
export const ORGANIC_LOADER_VARIANTS: OrganicLoaderVariant[];

export function OrganicLoader(props: OrganicLoaderProps): JSX.Element;
