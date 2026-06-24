import React from "react";

/**
 * OrganicLoader — eight quiet pending states drawn in the Wabi-sabi
 * motion language (soft `ease`, ~1.5–9s loops, no spinners that race).
 * Each is a self-contained inline-flex glyph you can drop anywhere; pass
 * `label` to show a caption beneath it.
 *
 * Tone follows the system's meaning axis automatically:
 *   • sage  (`--auto-fg`) → active / positive  — ripple, motes, stones
 *   • ink   (`--ink-2`)   → neutral ambient    — enso, brush, reeds
 *   • seal  (`--accent`)  → urgent / held back   — seal, kintsugi
 * Override with `tone` only when the surrounding context demands it.
 *
 * Keyframes ship in tokens/base.css (ws-enso-*, ws-ripple, ws-breathe*,
 * ws-sweep, ws-drift, ws-sway, ws-seam, ws-place) — link styles.css.
 */
export function OrganicLoader({
  variant = "enso",
  label,
  tone,
  size,
  className,
  style,
  ...rest
}) {
  const accent = tone ? `var(--${tone})` : undefined;
  const render = GLYPHS[variant] || GLYPHS.enso;
  const glyph = render(accent);

  // `size` shrinks the glyph into a fixed square slot — for compact/inline
  // use (e.g. a leading mark in a status line). Best for the square variants
  // (enso, ripple, seal, motes, reeds, stones); the wide ones (brush,
  // kintsugi) are meant to be shown at full width, not miniaturized.
  const scaled =
    size == null ? (
      glyph
    ) : (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `scale(${size / (GLYPH_BASE[variant] || 56)})`, transformOrigin: "center", display: "flex" }}>{glyph}</div>
      </div>
    );

  return (
    <div
      role="status"
      aria-label={label || `Loading — ${variant}`}
      aria-live="polite"
      className={className}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        ...style,
      }}
      {...rest}
    >
      <div
        aria-hidden="true"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: size == null ? 48 : size }}
      >
        {scaled}
      </div>
      {label && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "0.04em",
            color: "var(--ink-3)",
            textAlign: "center",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

// Intrinsic bounding size of each glyph, used to compute the `size` scale.
const GLYPH_BASE = {
  enso: 62,
  ripple: 62,
  seal: 48,
  brush: 108,
  motes: 80,
  reeds: 44,
  kintsugi: 120,
  stones: 66,
};

export const ORGANIC_LOADER_VARIANTS = [
  "enso",
  "ripple",
  "seal",
  "brush",
  "motes",
  "reeds",
  "kintsugi",
  "stones",
];

const GLYPHS = {
  // 1. Ensō — an ink ring breathing open and closed.
  enso: (c = "var(--ink-2)") => (
    <svg width="62" height="62" viewBox="0 0 62 62" style={{ animation: "ws-enso-spin 9s linear infinite", transformOrigin: "center" }}>
      <circle
        cx="31"
        cy="31"
        r="26"
        fill="none"
        stroke={c}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeDasharray="163 232"
        strokeDashoffset="36"
        style={{ animation: "ws-enso-draw 3.4s ease-in-out infinite", transformOrigin: "center", transform: "rotate(112deg)" }}
      />
    </svg>
  ),

  // 2. Ink ripple — a stone dropped in still water.
  ripple: (c = "var(--auto-fg)") => (
    <div style={{ position: "relative", width: 62, height: 62 }}>
      {[0, 0.93, 1.86].map((d) => (
        <span
          key={d}
          style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${c}`, animation: `ws-ripple 2.8s ease-out infinite`, animationDelay: `${d}s` }}
        />
      ))}
      <span style={{ position: "absolute", left: "50%", top: "50%", width: 7, height: 7, margin: "-3.5px 0 0 -3.5px", borderRadius: "50%", background: c }} />
    </div>
  ),

  // 3. Breathing seal — a persimmon dot, held back for the urgent tone.
  seal: (c = "var(--accent)") => (
    <div style={{ position: "relative", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ position: "absolute", width: 30, height: 30, borderRadius: "50%", background: c, animation: "ws-breathe-halo 2.2s ease-in-out infinite" }} />
      <span style={{ width: 18, height: 18, borderRadius: "50%", background: c, animation: "ws-breathe 2.2s ease-in-out infinite" }} />
    </div>
  ),

  // 4. Brush sweep — a single sumi stroke passing through.
  brush: (c = "var(--ink-2)") => (
    <div style={{ position: "relative", width: 108, height: 9, borderRadius: 6, background: "var(--surface-2)", overflow: "hidden" }}>
      <span style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "55%", borderRadius: 6, background: `linear-gradient(90deg, transparent, ${c} 45%, ${c} 55%, transparent)`, animation: "ws-sweep 1.9s ease-in-out infinite" }} />
    </div>
  ),

  // 5. Settling motes — dust drifting on a slow current.
  motes: (c = "var(--auto-fg)") => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 11 }}>
      {[0, 0.45, 0.9, 1.35, 1.8].map((d) => (
        <span key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: c, animation: "ws-drift 2.6s ease-in-out infinite", animationDelay: `${d}s` }} />
      ))}
    </div>
  ),

  // 6. Reeds — hairlines swaying like reeds in wind.
  reeds: (c = "var(--ink-2)") => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, height: 40 }}>
      {[0, 0.18, 0.36, 0.54, 0.72].map((d) => (
        <span key={d} style={{ width: 3, height: 38, borderRadius: 3, background: c, transformOrigin: "bottom", animation: "ws-sway 1.5s ease-in-out infinite", animationDelay: `${d}s` }} />
      ))}
    </div>
  ),

  // 7. Kintsugi seam — a golden seam drawing itself closed.
  kintsugi: (c = "var(--accent)") => (
    <svg width="120" height="44" viewBox="0 0 120 44">
      <path d="M4 30 L26 14 L44 26 L66 8 L86 28 L116 16" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="150" strokeDashoffset="150" style={{ animation: "ws-seam 3.2s ease-in-out infinite" }} />
    </svg>
  ),

  // 8. Stone placement — stones set down one at a time.
  stones: (c = "var(--auto-fg)") => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 13 }}>
      {[0, 0.3, 0.6].map((d) => (
        <span key={d} style={{ width: 13, height: 13, borderRadius: "50%", background: c, animation: "ws-place 2.4s ease-in-out infinite", animationDelay: `${d}s` }} />
      ))}
    </div>
  ),
};
