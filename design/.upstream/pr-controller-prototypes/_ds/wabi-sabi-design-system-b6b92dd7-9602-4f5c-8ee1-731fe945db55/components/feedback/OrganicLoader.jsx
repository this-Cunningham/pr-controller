import React from "react";

/**
 * OrganicLoader — twenty-eight quiet pending states drawn in the Wabi-sabi
 * motion language (soft `ease`, ~1.5–20s loops, no spinners that race).
 * Each is a self-contained inline-flex glyph you can drop anywhere; pass
 * `label` to show a caption beneath it. The "working" blobs (seeker;
 * its amplified cousins diviner and swarm; and the eye blobs vigil and
 * wisp, plus vigil's family sentinel/drowse/scan/saccade and wisp's
 * family comet/veil) are morphing shapes for indeterminate active
 * work — they read as something with intelligence behind them.
 *
 * Tone follows the system's meaning axis automatically:
 *   • sage  (`--auto-fg`) → active / positive  — ripple, motes, stones
 *   • ink   (`--ink-2`)   → neutral ambient    — enso, brush, reeds
 *   • seal  (`--accent`)  → urgent / held back   — seal, kintsugi
 * Override with `tone` only when the surrounding context demands it.
 *
 * Keyframes ship in tokens/base.css (ws-enso-*, ws-ripple, ws-breathe*,
 * ws-sweep, ws-drift, ws-sway, ws-seam, ws-place, ws-blob-*, ws-swarm-*,
 * ws-gaze-wander*, ws-gaze-drift*, ws-vigil-sweep, ws-sweep-wide,
 * ws-blink*, ws-droop, ws-scan, ws-saccade) — link styles.css.
 */
export function OrganicLoader({
  variant = "enso",
  label,
  tone,
  size,
  phase,
  className,
  style,
  ...rest
}) {
  const accent = tone ? `var(--${tone})` : undefined;
  const render = GLYPHS[variant] || GLYPHS.enso;
  const glyph = render(accent);

  // Per-instance phase offset: shift every animated element inside this
  // loader by the SAME negative delay, so the instance stays internally
  // coherent while drifting out of step with other instances on the page.
  // Without this, identical loaders mounted together run frame-for-frame in
  // sync (mechanical) — applies to every variant, blob and ambient alike.
  // `phase` (0–1) forces a deterministic offset; omit it for a random one.
  // Respects prefers-reduced-motion.
  //
  // We read each element's INLINE `animation` shorthand (which the glyphs
  // always set) rather than its computed style. Computed styles report
  // animationName:none until the external keyframe CSS (tokens/base.css)
  // has loaded — so if the component mounts before that stylesheet arrives
  // (common in a real app), a computed-style approach offsets nothing and
  // every instance starts in sync. The inline value exists immediately.
  // Each element's original delay is cached on a data attr so repeat runs
  // (tone/size changes) don't compound the offset.
  const rootRef = React.useRef(null);
  const phaseRef = React.useRef(phase == null ? Math.random() : phase);
  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // 40s comfortably exceeds the longest loop, so the offset can land
    // anywhere in every variant's cycle.
    const frac = phase == null ? phaseRef.current : phase;
    const offset = -(frac * 40);
    root.querySelectorAll('[style*="animation"]').forEach((el) => {
      let base = el.dataset.olBaseDelay;
      if (base == null) {
        base = el.style.animationDelay || "0s";
        el.dataset.olBaseDelay = base;
      }
      el.style.animationDelay = base
        .split(",")
        .map((d) => (parseFloat(d) || 0) + offset + "s")
        .join(", ");
    });
  }, [variant, size, tone, phase]);

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
      ref={rootRef}
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
  seeker: 56,
  diviner: 56,
  swarm: 80,
  vigil: 56,
  wisp: 56,
  sentinel: 56,
  drowse: 56,
  scan: 56,
  saccade: 56,
  comet: 56,
  veil: 56,
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
  "seeker",
  "diviner",
  "swarm",
  "vigil",
  "wisp",
  "sentinel",
  "drowse",
  "scan",
  "saccade",
  "comet",
  "veil",
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

  // 9. Seeker — a blob that morphs as it thinks, turning slowly to consider.
  seeker: (c = "var(--auto-fg)") => (
    <div style={{ width: 44, height: 44, animation: "ws-blob-rot 14s linear infinite", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ width: 40, height: 40, background: c, opacity: 0.92, borderRadius: "42% 58% 63% 37% / 41% 44% 56% 59%", animation: "ws-blob-morph 4.2s ease-in-out infinite, ws-blob-pulse 2.6s ease-in-out infinite" }} />
    </div>
  ),

  // ---- Amplified cousins: the same four, pushed louder & less determinate ----

  // 13. Diviner — seeker turned restless: morphing harder, breathing wider,
  //     spinning both ways at once.
  diviner: (c = "var(--auto-fg)") => (
    <div style={{ width: 44, height: 44, animation: "ws-blob-rot 20s linear infinite", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ width: 40, height: 40, background: c, opacity: 0.92, borderRadius: "38% 62% 70% 30% / 30% 58% 42% 70%", animation: "ws-blob-morph2 6s ease-in-out infinite, ws-blob-pulse2 3.7s ease-in-out infinite" }} />
    </div>
  ),

  // 16. Swarm — three gooey blobs circling and merging,
  //     a restless collective mind.
  swarm: (c = "var(--auto-fg)") => (
    <div style={{ position: "relative", width: 80, height: 44, filter: "url(#ws-goo2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="ws-goo2">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
          <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" />
        </filter>
      </svg>
      <span style={{ position: "absolute", width: 24, height: 24, borderRadius: "50%", background: c, animation: "ws-swarm-a 4s ease-in-out infinite" }} />
      <span style={{ position: "absolute", width: 24, height: 24, borderRadius: "50%", background: c, animation: "ws-swarm-b 4s ease-in-out infinite" }} />
      <span style={{ position: "absolute", width: 24, height: 24, borderRadius: "50%", background: c, animation: "ws-swarm-c 4s ease-in-out infinite" }} />
    </div>
  ),

  // ---- Eye blobs: the morphing blob read as a watching eye ----

  // 18. Vigil — one watchful eye sweeping the horizon, blinking now and then.
  vigil: (c = "var(--auto-fg)") => (
    <div style={{ position: "relative", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ width: 42, height: 42, background: c, opacity: 0.9, borderRadius: "38% 62% 70% 30% / 30% 58% 42% 70%", animation: "ws-blob-morph2 6.4s ease-in-out -2s infinite" }} />
      <span style={{ position: "absolute", width: 11, height: 11, display: "flex", alignItems: "center", justifyContent: "center", animation: "ws-vigil-sweep 30s ease-in-out infinite, ws-gaze-drift 27s ease-in-out infinite" }}>
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--bg)", animation: "ws-blink 33s ease-in-out infinite" }} />
      </span>
    </div>
  ),

  // 20. Wisp — the gaze and its after-image, attention lagging a beat behind.
  wisp: (c = "var(--auto-fg)") => (
    <div style={{ position: "relative", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ width: 42, height: 42, background: c, opacity: 0.9, borderRadius: "38% 62% 70% 30% / 30% 58% 42% 70%", animation: "ws-blob-morph2 5.8s ease-in-out -5s infinite" }} />
      <span style={{ position: "absolute", width: 9, height: 9, borderRadius: "50%", background: "var(--bg)", opacity: 0.3, animation: "ws-gaze-wander 34s ease-in-out infinite, ws-gaze-drift 27s ease-in-out infinite", animationDelay: "0.5s" }} />
      <span style={{ position: "absolute", width: 9, height: 9, borderRadius: "50%", background: "var(--bg)", animation: "ws-gaze-wander 34s ease-in-out infinite, ws-gaze-drift 27s ease-in-out infinite" }} />
    </div>
  ),

  // ---- Vigil's family: the watchful eye, four temperaments ----

  // 21. Sentinel — a wide, slow arc with a sharp double-blink at the turn.
  sentinel: (c = "var(--auto-fg)") => (
    <div style={{ position: "relative", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ width: 42, height: 42, background: c, opacity: 0.9, borderRadius: "38% 62% 70% 30% / 30% 58% 42% 70%", animation: "ws-blob-morph2 7.2s ease-in-out -1s infinite" }} />
      <span style={{ position: "absolute", width: 11, height: 11, display: "flex", alignItems: "center", justifyContent: "center", animation: "ws-sweep-wide 34s ease-in-out infinite, ws-gaze-drift2 29s ease-in-out infinite" }}>
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--bg)", animation: "ws-blink-twice 38s ease-in-out infinite" }} />
      </span>
    </div>
  ),

  // 22. Drowse — heavy-lidded, drifting low, blinking long and often.
  drowse: (c = "var(--auto-fg)") => (
    <div style={{ position: "relative", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ width: 42, height: 42, background: c, opacity: 0.9, borderRadius: "38% 62% 70% 30% / 30% 58% 42% 70%", animation: "ws-blob-morph2 6s ease-in-out -8s infinite" }} />
      <span style={{ position: "absolute", width: 12, height: 12, display: "flex", alignItems: "center", justifyContent: "center", animation: "ws-droop 30s ease-in-out infinite, ws-gaze-drift 25s ease-in-out infinite" }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--bg)", animation: "ws-blink-heavy 31s ease-in-out infinite" }} />
      </span>
    </div>
  ),

  // 23. Scan — the eye tracing a slow oval, sweeping the whole field.
  scan: (c = "var(--auto-fg)") => (
    <div style={{ position: "relative", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ width: 42, height: 42, background: c, opacity: 0.9, borderRadius: "38% 62% 70% 30% / 30% 58% 42% 70%", animation: "ws-blob-morph2 7.6s ease-in-out -3.5s infinite" }} />
      <span style={{ position: "absolute", width: 11, height: 11, borderRadius: "50%", background: "var(--bg)", animation: "ws-scan 32s ease-in-out infinite, ws-gaze-drift2 27s ease-in-out infinite" }} />
    </div>
  ),

  // 24. Saccade — quick darting glances that hold, then jump again.
  saccade: (c = "var(--auto-fg)") => (
    <div style={{ position: "relative", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ width: 42, height: 42, background: c, opacity: 0.9, borderRadius: "38% 62% 70% 30% / 30% 58% 42% 70%", animation: "ws-blob-morph2 5.6s ease-in-out -6.5s infinite" }} />
      <span style={{ position: "absolute", width: 11, height: 11, borderRadius: "50%", background: "var(--bg)", animation: "ws-saccade 30s ease-in-out infinite, ws-gaze-drift 26s ease-in-out infinite" }} />
    </div>
  ),

  // ---- Wisp's family: the gaze and its after-images, four ways ----

  // 25. Comet — a tail of three after-images strung out behind the gaze.
  comet: (c = "var(--auto-fg)") => (
    <div style={{ position: "relative", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ width: 42, height: 42, background: c, opacity: 0.9, borderRadius: "38% 62% 70% 30% / 30% 58% 42% 70%", animation: "ws-blob-morph2 6.8s ease-in-out -2.5s infinite" }} />
      {[0.9, 0.6, 0.3, 0].map((delay, i) => (
        <span key={i} style={{ position: "absolute", width: 9, height: 9, borderRadius: "50%", background: "var(--bg)", opacity: 0.22 + i * 0.26, animation: "ws-gaze-wander 34s ease-in-out infinite, ws-gaze-drift 27s ease-in-out infinite", animationDelay: `${delay}s` }} />
      ))}
    </div>
  ),

  // 28. Veil — a soft, oversized after-image trailing the sharp gaze.
  veil: (c = "var(--auto-fg)") => (
    <div style={{ position: "relative", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ width: 42, height: 42, background: c, opacity: 0.9, borderRadius: "38% 62% 70% 30% / 30% 58% 42% 70%", animation: "ws-blob-morph2 7s ease-in-out -9s infinite" }} />
      <span style={{ position: "absolute", width: 18, height: 18, borderRadius: "50%", background: "var(--bg)", opacity: 0.16, animation: "ws-gaze-wander 34s ease-in-out infinite, ws-gaze-drift 27s ease-in-out infinite", animationDelay: "0.7s" }} />
      <span style={{ position: "absolute", width: 9, height: 9, borderRadius: "50%", background: "var(--bg)", animation: "ws-gaze-wander 34s ease-in-out infinite, ws-gaze-drift 27s ease-in-out infinite" }} />
    </div>
  ),
};
