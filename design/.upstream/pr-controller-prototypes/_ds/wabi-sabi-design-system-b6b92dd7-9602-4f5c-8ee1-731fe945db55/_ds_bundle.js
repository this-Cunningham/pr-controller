/* @ds-bundle: {"format":3,"namespace":"DesignSystem_220c99","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Callout","sourcePath":"components/core/Callout.jsx"},{"name":"DispositionTag","sourcePath":"components/core/DispositionTag.jsx"},{"name":"TextButton","sourcePath":"components/core/TextButton.jsx"},{"name":"ThemeSwitcher","sourcePath":"components/core/ThemeSwitcher.jsx"},{"name":"Toggle","sourcePath":"components/core/Toggle.jsx"},{"name":"Confirmation","sourcePath":"components/feedback/Confirmation.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"OrganicLoader","sourcePath":"components/feedback/OrganicLoader.jsx"},{"name":"ORGANIC_LOADER_VARIANTS","sourcePath":"components/feedback/OrganicLoader.jsx"},{"name":"Skeleton","sourcePath":"components/feedback/Skeleton.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"ScopeBadge","sourcePath":"components/navigation/ScopeBadge.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"cf9123c92f9f","components/core/Button.jsx":"9133a55abe22","components/core/Callout.jsx":"5cf5c0ee27ff","components/core/DispositionTag.jsx":"253f5312dd69","components/core/TextButton.jsx":"6da76c4579a2","components/core/ThemeSwitcher.jsx":"c19d5289dd65","components/core/Toggle.jsx":"323769b914fe","components/feedback/Confirmation.jsx":"9c81dd82ed06","components/feedback/EmptyState.jsx":"ee1bbe09729e","components/feedback/OrganicLoader.jsx":"1228cfeae5f2","components/feedback/Skeleton.jsx":"22537c52e63c","components/feedback/Toast.jsx":"dcafec14413a","components/navigation/ScopeBadge.jsx":"dccad81e40e0","components/navigation/Tabs.jsx":"2162b64f8691"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DesignSystem_220c99 = window.DesignSystem_220c99 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
const tones = {
  neutral: {
    background: "var(--surface-2)",
    color: "var(--ink-2)",
    border: "transparent"
  },
  active: {
    background: "var(--auto-bg)",
    color: "var(--auto-fg)",
    border: "transparent"
  },
  urgent: {
    background: "var(--accent-bg)",
    color: "var(--accent)",
    border: "transparent"
  },
  praise: {
    background: "var(--praise-bg)",
    color: "var(--praise-fg)",
    border: "transparent"
  },
  outline: {
    background: "transparent",
    color: "var(--ink-3)",
    border: "var(--line-2)"
  }
};

/**
 * Small status pill. The `dot` adds a leading marker; `mono` renders
 * uppercase tracked mono (for status pills). Tones speak the system's
 * abstract vocabulary: neutral, active, urgent, praise, and the
 * de-emphasized `outline`.
 */
function Badge({
  tone = "neutral",
  dot = false,
  mono = false,
  children
}) {
  const t = tones[tone] || tones.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
      fontSize: mono ? 11 : 11.5,
      letterSpacing: mono ? "0.06em" : "normal",
      textTransform: mono ? "uppercase" : "none",
      padding: mono ? "4px 9px" : "3px 9px",
      borderRadius: "var(--radius-chip)",
      background: t.background,
      color: t.color,
      border: `1px solid ${t.border}`
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      borderRadius: "50%",
      background: "currentColor",
      display: "inline-block"
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
const base = {
  cursor: "pointer",
  font: "500 13px var(--font-sans)",
  padding: "var(--pad-button)",
  borderRadius: "var(--radius-card)",
  transition: "opacity .15s ease, background .15s ease"
};
const variants = {
  primary: {
    background: "var(--ink)",
    color: "var(--bg)",
    border: "1px solid var(--ink)"
  },
  outline: {
    background: "transparent",
    color: "var(--ink)",
    border: "1px solid var(--line-2)"
  },
  ghost: {
    background: "transparent",
    color: "var(--ink-2)",
    border: "1px solid transparent"
  }
};
const hover = {
  primary: {
    opacity: 0.86
  },
  outline: {
    background: "var(--surface-2)"
  },
  ghost: {
    color: "var(--ink)"
  }
};

/**
 * Primary action button in three weights. Solid `primary` for the
 * main action, `outline` for secondary, `ghost` for low-stakes (Skip).
 */
function Button({
  variant = "primary",
  onClick,
  disabled = false,
  children
}) {
  const [h, setH] = React.useState(false);
  const v = variants[variant] || variants.primary;
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    disabled: disabled,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      ...base,
      ...v,
      ...(h && !disabled ? hover[variant] : null),
      opacity: disabled ? 0.45 : h ? hover[variant]?.opacity ?? 1 : 1,
      cursor: disabled ? "not-allowed" : "pointer"
    }
  }, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Callout.jsx
try { (() => {
const tones = {
  urgent: {
    rule: "var(--accent)",
    bg: "var(--accent-soft)",
    mark: "var(--accent)"
  },
  active: {
    rule: "var(--auto-fg)",
    bg: "var(--auto-bg)",
    mark: "var(--auto-fg)"
  },
  neutral: {
    rule: "var(--line-2)",
    bg: "var(--surface-2)",
    mark: "var(--ink-3)"
  }
};

/**
 * Left-ruled status box. The system's workhorse for ambient status:
 * `urgent` for things that need attention, `active` for in-progress /
 * positive, `neutral` for suggestions and quoted text. Optional eyebrow
 * label and a status dot that can pulse (use pulse for live states).
 */
function Callout({
  tone = "neutral",
  eyebrow,
  dot = false,
  pulse = false,
  children
}) {
  const t = tones[tone] || tones.neutral;
  const hasHeader = eyebrow || dot;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: t.bg,
      borderLeft: `3px solid ${t.rule}`,
      borderRadius: "0 var(--radius-card) var(--radius-card) 0",
      padding: "12px 14px"
    }
  }, hasHeader && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: children ? 7 : 0
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: t.mark,
      flex: "none",
      animation: pulse ? "ws-pulse var(--pulse) var(--ease-in-out) infinite" : "none"
    }
  }), eyebrow && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      letterSpacing: "var(--tracking-eyebrow)",
      textTransform: "uppercase",
      color: t.mark
    }
  }, eyebrow)), children && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      lineHeight: 1.5,
      color: "var(--ink)"
    }
  }, children));
}
Object.assign(__ds_scope, { Callout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Callout.jsx", error: String((e && e.message) || e) }); }

// components/core/DispositionTag.jsx
try { (() => {
const tones = {
  urgent: {
    background: "var(--accent-bg)",
    color: "var(--accent)",
    border: "none"
  },
  // needs attention
  active: {
    background: "var(--auto-bg)",
    color: "var(--auto-fg)",
    border: "none"
  },
  // in progress / positive
  neutral: {
    background: "var(--surface-2)",
    color: "var(--ink-2)",
    border: "none"
  },
  // quiet / informational
  praise: {
    background: "var(--praise-bg)",
    color: "var(--praise-fg)",
    border: "none"
  },
  // praise
  error: {
    background: "var(--err-bg)",
    color: "var(--err-fg)",
    border: "none"
  },
  // error (calm, not alarming)
  pending: {
    background: "transparent",
    color: "var(--pending-fg)",
    border: "1px dashed var(--pending-border)"
  } // not started
};

/**
 * Uppercase mono tag for a row-level state. Six tones in the system's
 * abstract vocabulary. `pending` (dashed, unfilled) is the not-started
 * state — quieter than `neutral`.
 */
function DispositionTag({
  tone = "neutral",
  children
}) {
  const t = tones[tone] || tones.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 10.5,
      letterSpacing: "var(--tracking-tag)",
      textTransform: "uppercase",
      padding: t.border === "none" ? "3px 8px" : "2px 7px",
      borderRadius: "var(--radius-chip)",
      background: t.background,
      color: t.color,
      border: t.border
    }
  }, children);
}
Object.assign(__ds_scope, { DispositionTag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/DispositionTag.jsx", error: String((e && e.message) || e) }); }

// components/core/TextButton.jsx
try { (() => {
/**
 * Quiet inline text button for low-stakes actions (Show more, Undo).
 * No fill, no border — just colored text. `tone` accent (default) or
 * muted (ink-2). Underlined by default.
 */
function TextButton({
  onClick,
  tone = "accent",
  underline = true,
  children
}) {
  const [h, setH] = React.useState(false);
  const color = tone === "muted" ? "var(--ink-2)" : "var(--accent)";
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      background: "none",
      border: "none",
      padding: 0,
      font: "12.5px var(--font-sans)",
      color,
      textDecoration: underline ? "underline" : "none",
      textUnderlineOffset: 2,
      cursor: "pointer",
      opacity: h ? 0.7 : 1
    }
  }, children);
}
Object.assign(__ds_scope, { TextButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/TextButton.jsx", error: String((e && e.message) || e) }); }

// components/core/ThemeSwitcher.jsx
try { (() => {
const THEMES = [{
  value: "stone-dark",
  label: "Stone · Dark"
}, {
  value: "stone-light",
  label: "Stone · Light"
}, {
  value: "warm-dark",
  label: "Warm · Dark"
}, {
  value: "warm-light",
  label: "Warm · Light"
}, {
  value: "tea-dark",
  label: "Tea · Dark"
}, {
  value: "tea-light",
  label: "Tea · Light"
}];

/**
 * Runtime theme picker. Uncontrolled by default — it writes
 * `data-theme` onto <html>, which retints every token. Pass
 * `value` + `onChange` to control it externally.
 */
function ThemeSwitcher({
  value,
  onChange,
  themes = THEMES
}) {
  const [internal, setInternal] = React.useState(() => typeof document !== "undefined" && document.documentElement.dataset.theme || "stone-dark");
  const current = value ?? internal;
  const apply = next => {
    if (typeof document !== "undefined") document.documentElement.dataset.theme = next;
    if (value === undefined) setInternal(next);
    onChange && onChange(next);
  };
  return /*#__PURE__*/React.createElement("select", {
    value: current,
    onChange: e => apply(e.target.value),
    "aria-label": "Theme",
    style: {
      font: "500 12.5px var(--font-sans)",
      color: "var(--ink-2)",
      background: "var(--surface)",
      border: "1px solid var(--line-2)",
      borderRadius: "var(--radius-control)",
      padding: "7px 11px",
      cursor: "pointer"
    }
  }, themes.map(t => /*#__PURE__*/React.createElement("option", {
    key: t.value,
    value: t.value
  }, t.label)));
}
Object.assign(__ds_scope, { ThemeSwitcher });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ThemeSwitcher.jsx", error: String((e && e.message) || e) }); }

// components/core/Toggle.jsx
try { (() => {
/**
 * Binary on/off switch. Controlled via `checked` + `onChange`, or
 * left uncontrolled (manages its own state). `disabled` renders a
 * de-emphasized dashed track that ignores input. The "on" track uses
 * the sage auto-fg; "off" is a quiet filled surface with a hairline.
 */
function Toggle({
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  label,
  id
}) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(defaultChecked);
  const on = isControlled ? checked : internal;
  const toggle = () => {
    if (disabled) return;
    const next = !on;
    if (!isControlled) setInternal(next);
    onChange && onChange(next);
  };
  const state = disabled ? "disabled" : on ? "on" : "off";
  const track = {
    on: {
      background: "var(--auto-fg)",
      border: "1px solid var(--auto-fg)"
    },
    off: {
      background: "var(--surface-2)",
      border: "1px solid var(--line-2)"
    },
    disabled: {
      background: "transparent",
      border: "1px dashed var(--line-2)"
    }
  }[state];
  const knob = {
    on: {
      left: 19,
      background: "var(--bg)",
      boxShadow: "var(--shadow-1, 0 1px 2px rgba(0,0,0,.18))"
    },
    off: {
      left: 3,
      background: "var(--ink-3)",
      boxShadow: "var(--shadow-1, 0 1px 2px rgba(0,0,0,.18))"
    },
    disabled: {
      left: 3,
      background: "var(--line-2)",
      boxShadow: "none"
    }
  }[state];
  const sw = /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "switch",
    id: id,
    "aria-checked": on,
    "aria-disabled": disabled || undefined,
    onClick: toggle,
    style: {
      position: "relative",
      width: 38,
      height: 22,
      flex: "none",
      padding: 0,
      borderRadius: 999,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.55 : 1,
      transition: "background .18s ease, border-color .18s ease",
      ...track
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 2,
      width: 16,
      height: 16,
      borderRadius: "50%",
      transition: "left .18s ease",
      ...knob
    }
  }));
  if (!label) return sw;
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      cursor: disabled ? "not-allowed" : "pointer",
      font: "500 13px var(--font-sans)",
      color: disabled ? "var(--ink-3)" : "var(--ink-2)"
    }
  }, sw, label);
}
Object.assign(__ds_scope, { Toggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Toggle.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Confirmation.jsx
try { (() => {
/**
 * Inline confirmation line shown after an action resolves, with an
 * optional Undo affordance.
 */
function Confirmation({
  text,
  fg = "var(--ink-2)",
  onUndo
}) {
  const [h, setH] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 11,
      display: "flex",
      alignItems: "center",
      gap: 10,
      animation: "ws-appear var(--dur-card) var(--ease)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: fg
    }
  }, text), onUndo && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onUndo,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      background: "none",
      border: "none",
      padding: 0,
      font: "12.5px var(--font-sans)",
      color: "var(--accent)",
      textDecoration: "underline",
      cursor: "pointer",
      opacity: h ? 0.7 : 1
    }
  }, "Undo"));
}
Object.assign(__ds_scope, { Confirmation });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Confirmation.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
/**
 * Calm empty state — an open ensō circle and an italic line.
 * Used when a section has nothing to show.
 */
function EmptyState({
  label = "Nothing here right now."
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 13,
      padding: "24px 4px",
      color: "var(--ink-3)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 26,
      height: 26,
      border: "1.5px solid var(--line-2)",
      borderTopColor: "transparent",
      borderRadius: "50%",
      display: "inline-block",
      transform: "rotate(-20deg)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13.5,
      fontStyle: "italic"
    }
  }, label));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/OrganicLoader.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function OrganicLoader({
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
  const scaled = size == null ? glyph : /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      transform: `scale(${size / (GLYPH_BASE[variant] || 56)})`,
      transformOrigin: "center",
      display: "flex"
    }
  }, glyph));
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "status",
    "aria-label": label || `Loading — ${variant}`,
    "aria-live": "polite",
    className: className,
    style: {
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 14,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: size == null ? 48 : size
    }
  }, scaled), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      letterSpacing: "0.04em",
      color: "var(--ink-3)",
      textAlign: "center"
    }
  }, label));
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
  stones: 66
};
const ORGANIC_LOADER_VARIANTS = ["enso", "ripple", "seal", "brush", "motes", "reeds", "kintsugi", "stones"];
const GLYPHS = {
  // 1. Ensō — an ink ring breathing open and closed.
  enso: (c = "var(--ink-2)") => /*#__PURE__*/React.createElement("svg", {
    width: "62",
    height: "62",
    viewBox: "0 0 62 62",
    style: {
      animation: "ws-enso-spin 9s linear infinite",
      transformOrigin: "center"
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "31",
    cy: "31",
    r: "26",
    fill: "none",
    stroke: c,
    strokeWidth: "3.2",
    strokeLinecap: "round",
    strokeDasharray: "163 232",
    strokeDashoffset: "36",
    style: {
      animation: "ws-enso-draw 3.4s ease-in-out infinite",
      transformOrigin: "center",
      transform: "rotate(112deg)"
    }
  })),
  // 2. Ink ripple — a stone dropped in still water.
  ripple: (c = "var(--auto-fg)") => /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 62,
      height: 62
    }
  }, [0, 0.93, 1.86].map(d => /*#__PURE__*/React.createElement("span", {
    key: d,
    style: {
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      border: `2px solid ${c}`,
      animation: `ws-ripple 2.8s ease-out infinite`,
      animationDelay: `${d}s`
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: "50%",
      top: "50%",
      width: 7,
      height: 7,
      margin: "-3.5px 0 0 -3.5px",
      borderRadius: "50%",
      background: c
    }
  })),
  // 3. Breathing seal — a persimmon dot, held back for the urgent tone.
  seal: (c = "var(--accent)") => /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 48,
      height: 48,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      width: 30,
      height: 30,
      borderRadius: "50%",
      background: c,
      animation: "ws-breathe-halo 2.2s ease-in-out infinite"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 18,
      borderRadius: "50%",
      background: c,
      animation: "ws-breathe 2.2s ease-in-out infinite"
    }
  })),
  // 4. Brush sweep — a single sumi stroke passing through.
  brush: (c = "var(--ink-2)") => /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 108,
      height: 9,
      borderRadius: 6,
      background: "var(--surface-2)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      height: "100%",
      width: "55%",
      borderRadius: 6,
      background: `linear-gradient(90deg, transparent, ${c} 45%, ${c} 55%, transparent)`,
      animation: "ws-sweep 1.9s ease-in-out infinite"
    }
  })),
  // 5. Settling motes — dust drifting on a slow current.
  motes: (c = "var(--auto-fg)") => /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 11
    }
  }, [0, 0.45, 0.9, 1.35, 1.8].map(d => /*#__PURE__*/React.createElement("span", {
    key: d,
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: c,
      animation: "ws-drift 2.6s ease-in-out infinite",
      animationDelay: `${d}s`
    }
  }))),
  // 6. Reeds — hairlines swaying like reeds in wind.
  reeds: (c = "var(--ink-2)") => /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      height: 40
    }
  }, [0, 0.18, 0.36, 0.54, 0.72].map(d => /*#__PURE__*/React.createElement("span", {
    key: d,
    style: {
      width: 3,
      height: 38,
      borderRadius: 3,
      background: c,
      transformOrigin: "bottom",
      animation: "ws-sway 1.5s ease-in-out infinite",
      animationDelay: `${d}s`
    }
  }))),
  // 7. Kintsugi seam — a golden seam drawing itself closed.
  kintsugi: (c = "var(--accent)") => /*#__PURE__*/React.createElement("svg", {
    width: "120",
    height: "44",
    viewBox: "0 0 120 44"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 30 L26 14 L44 26 L66 8 L86 28 L116 16",
    fill: "none",
    stroke: c,
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeDasharray: "150",
    strokeDashoffset: "150",
    style: {
      animation: "ws-seam 3.2s ease-in-out infinite"
    }
  })),
  // 8. Stone placement — stones set down one at a time.
  stones: (c = "var(--auto-fg)") => /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 13
    }
  }, [0, 0.3, 0.6].map(d => /*#__PURE__*/React.createElement("span", {
    key: d,
    style: {
      width: 13,
      height: 13,
      borderRadius: "50%",
      background: c,
      animation: "ws-place 2.4s ease-in-out infinite",
      animationDelay: `${d}s`
    }
  })))
};
Object.assign(__ds_scope, { OrganicLoader, ORGANIC_LOADER_VARIANTS });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/OrganicLoader.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Skeleton.jsx
try { (() => {
const shimmer = {
  background: "var(--surface-2)",
  borderRadius: 4,
  animation: "ws-shimmer 1.4s var(--ease-in-out) infinite"
};
const card = opacity => ({
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-card)",
  padding: 20,
  opacity
});

/**
 * First-fetch loading state — a caption and three fading placeholder
 * cards. Shown until the first fetch resolves.
 */
function Skeleton({
  caption = "Loading…",
  count = 3
}) {
  const opacities = [1, 0.8, 0.6];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 30
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.OrganicLoader, {
    variant: "enso",
    size: 18,
    "aria-hidden": "true",
    style: {
      flex: "none"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      color: "var(--ink-3)"
    }
  }, caption)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, Array.from({
    length: count
  }).map((_, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: card(opacities[i] ?? 0.5)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...shimmer,
      height: 11,
      width: 150
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...shimmer,
      height: 16,
      width: i === 0 ? "62%" : "50%",
      marginTop: 13
    }
  }), i === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      ...shimmer,
      height: 46,
      width: "100%",
      marginTop: 15
    }
  })))));
}
Object.assign(__ds_scope, { Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
/**
 * Transient bottom-center acknowledgment shown after an action.
 * Render it once near the root; pass the current message or null.
 * The host is responsible for clearing it on a timer.
 */
function Toast({
  message
}) {
  if (!message) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      left: "50%",
      bottom: 28,
      transform: "translateX(-50%)",
      background: "var(--ink)",
      color: "var(--bg)",
      fontSize: 13,
      padding: "11px 17px",
      borderRadius: "var(--radius-toast)",
      display: "flex",
      alignItems: "center",
      gap: 9,
      boxShadow: "var(--shadow-toast)",
      animation: "ws-fadeup var(--dur-fast) var(--ease)",
      zIndex: 50
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: "var(--accent)"
    }
  }), message);
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/navigation/ScopeBadge.jsx
try { (() => {
/**
 * Two-state scope toggle showing whether a view covers everything or a
 * scoped subset. "all" is calm (sage dot); "scoped"
 * uses the accent with a hollow ring to flag that some items are
 * deliberately out of view. Click toggles. Labels are overridable.
 */
function ScopeBadge({
  scope,
  count = 0,
  onToggle,
  allLabel = "All",
  scopedLabel
}) {
  const scoped = scope === "scoped";
  const scopedText = scopedLabel || `Scoped · ${count}`;
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onToggle,
    style: {
      background: "none",
      border: "none",
      padding: 0,
      cursor: "pointer",
      font: "inherit"
    }
  }, scoped ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      padding: "5px 12px",
      borderRadius: "var(--radius-round)",
      background: "var(--accent-bg)",
      color: "var(--accent)",
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      border: "1.5px solid var(--accent)"
    }
  }), scopedText) : /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      padding: "5px 12px",
      borderRadius: "var(--radius-round)",
      background: "var(--surface-2)",
      color: "var(--ink-2)",
      fontSize: 12,
      fontWeight: 500,
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: "var(--auto-fg)"
    }
  }), allLabel));
}
Object.assign(__ds_scope, { ScopeBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/ScopeBadge.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
/**
 * Sticky section tabs with count chips. The active tab carries an
 * accent underline; a tab can `emphasize` its count (accent chip) to
 * flag attention.
 */
function Tabs({
  tabs,
  active,
  onChange,
  sticky = true
}) {
  const [hover, setHover] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: sticky ? "sticky" : "static",
      top: 0,
      zIndex: 20,
      background: "var(--bg)",
      display: "flex",
      flexWrap: "wrap",
      borderBottom: "1px solid var(--line)",
      marginTop: 6,
      paddingTop: 8
    }
  }, tabs.map(tab => {
    const isActive = tab.key === active;
    const accentChip = tab.emphasize && tab.count > 0;
    const color = isActive || hover === tab.key ? "var(--ink)" : "var(--ink-2)";
    return /*#__PURE__*/React.createElement("button", {
      key: tab.key,
      type: "button",
      onClick: () => onChange(tab.key),
      onMouseEnter: () => setHover(tab.key),
      onMouseLeave: () => setHover(null),
      style: {
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "14px 0",
        marginRight: 26,
        marginBottom: -1,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        font: "600 14.5px var(--font-sans)",
        color,
        borderBottom: `2px solid ${isActive ? "var(--accent)" : "transparent"}`
      }
    }, tab.label, typeof tab.count === "number" && /*#__PURE__*/React.createElement("span", {
      style: {
        font: "500 11.5px var(--font-mono)",
        padding: "1px 8px",
        borderRadius: "var(--radius-round)",
        background: accentChip ? "var(--accent-bg)" : "var(--surface-2)",
        color: accentChip ? "var(--accent)" : "var(--ink-2)"
      }
    }, tab.count));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Callout = __ds_scope.Callout;

__ds_ns.DispositionTag = __ds_scope.DispositionTag;

__ds_ns.TextButton = __ds_scope.TextButton;

__ds_ns.ThemeSwitcher = __ds_scope.ThemeSwitcher;

__ds_ns.Toggle = __ds_scope.Toggle;

__ds_ns.Confirmation = __ds_scope.Confirmation;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.OrganicLoader = __ds_scope.OrganicLoader;

__ds_ns.ORGANIC_LOADER_VARIANTS = __ds_scope.ORGANIC_LOADER_VARIANTS;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.ScopeBadge = __ds_scope.ScopeBadge;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
