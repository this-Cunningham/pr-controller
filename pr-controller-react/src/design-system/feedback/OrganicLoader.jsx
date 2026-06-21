import React from "react";
import styles from "./OrganicLoader.module.css";

/**
 * OrganicLoader — eight quiet pending states drawn in the Wabi-sabi motion
 * language (soft easing, ~1.5–9s loops, no spinners that race). Each is a
 * self-contained glyph you can drop anywhere; pass `label` to show a caption
 * beneath it.
 *
 * Tone follows the system's meaning axis automatically — each variant carries
 * its intrinsic default (sage for active, ink for neutral, seal for urgent).
 * Override with `tone` (a raw token name: "ink-2" | "auto-fg" | "accent") only
 * when the surrounding context demands it. SVG strokes, dot fills and the brush
 * gradient all draw with `currentColor`, so a single `color` retints the glyph.
 *
 * Keyframes ship globally in tokens/base.css (ws-enso-*, ws-ripple, ws-breathe*,
 * ws-sweep, ws-drift, ws-sway, ws-seam, ws-place).
 */
export const ORGANIC_LOADER_VARIANTS = ["enso", "ripple", "seal", "brush", "motes", "reeds", "kintsugi", "stones"];

// Intrinsic bounding size of each glyph, used to compute the `size` scale.
const GLYPH_BASE = { enso: 62, ripple: 62, seal: 48, brush: 108, motes: 80, reeds: 44, kintsugi: 120, stones: 66 };

const GLYPHS = {
  // 1. Ensō — an ink ring breathing open and closed.
  enso: (c) => (
    <svg className={styles.enso} style={c} width="62" height="62" viewBox="0 0 62 62">
      <circle
        className={styles.ensoArc}
        cx="31"
        cy="31"
        r="26"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeDasharray="163 232"
        strokeDashoffset="36"
      />
    </svg>
  ),
  // 2. Ink ripple — a stone dropped in still water.
  ripple: (c) => (
    <div className={styles.ripple} style={c}>
      {[0, 0.93, 1.86].map((d) => (
        <span key={d} className={styles.rippleRing} style={{ animationDelay: `${d}s` }} />
      ))}
      <span className={styles.rippleCore} />
    </div>
  ),
  // 3. Breathing seal — a persimmon dot, held back for the urgent tone.
  seal: (c) => (
    <div className={styles.seal} style={c}>
      <span className={styles.sealHalo} />
      <span className={styles.sealDot} />
    </div>
  ),
  // 4. Brush sweep — a single sumi stroke passing through.
  brush: (c) => (
    <div className={styles.brush} style={c}>
      <span className={styles.brushStroke} />
    </div>
  ),
  // 5. Settling motes — dust drifting on a slow current.
  motes: (c) => (
    <div className={styles.motes} style={c}>
      {[0, 0.45, 0.9, 1.35, 1.8].map((d) => (
        <span key={d} className={styles.mote} style={{ animationDelay: `${d}s` }} />
      ))}
    </div>
  ),
  // 6. Reeds — hairlines swaying like reeds in wind.
  reeds: (c) => (
    <div className={styles.reeds} style={c}>
      {[0, 0.18, 0.36, 0.54, 0.72].map((d) => (
        <span key={d} className={styles.reed} style={{ animationDelay: `${d}s` }} />
      ))}
    </div>
  ),
  // 7. Kintsugi seam — a golden seam drawing itself closed.
  kintsugi: (c) => (
    <svg className={styles.kintsugi} style={c} width="120" height="44" viewBox="0 0 120 44">
      <path
        className={styles.kintsugiPath}
        d="M4 30 L26 14 L44 26 L66 8 L86 28 L116 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="150"
        strokeDashoffset="150"
      />
    </svg>
  ),
  // 8. Stone placement — stones set down one at a time.
  stones: (c) => (
    <div className={styles.stones} style={c}>
      {[0, 0.3, 0.6].map((d) => (
        <span key={d} className={styles.stone} style={{ animationDelay: `${d}s` }} />
      ))}
    </div>
  ),
};

export function OrganicLoader({ variant = "enso", label, tone, size, className, style, ...rest }) {
  const toneColor = tone ? { color: `var(--${tone})` } : undefined;
  const render = GLYPHS[variant] || GLYPHS.enso;
  const glyph = render(toneColor);

  // `size` shrinks the glyph into a fixed square slot — for compact/inline use
  // (e.g. a leading mark in a status line). Best for the square variants
  // (enso, ripple, seal, motes, reeds, stones); the wide ones (brush, kintsugi)
  // are meant to be shown at full width, not miniaturized.
  const scaled =
    size == null ? (
      glyph
    ) : (
      <div className={styles.scaleBox} style={{ width: size, height: size }}>
        <div className={styles.scaleInner} style={{ transform: `scale(${size / (GLYPH_BASE[variant] || 56)})` }}>
          {glyph}
        </div>
      </div>
    );

  return (
    <div
      role="status"
      aria-label={label || `Loading — ${variant}`}
      aria-live="polite"
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={style}
      {...rest}
    >
      <div className={styles.glyphSlot} style={size == null ? undefined : { minHeight: size }} aria-hidden="true">
        {scaled}
      </div>
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
}
