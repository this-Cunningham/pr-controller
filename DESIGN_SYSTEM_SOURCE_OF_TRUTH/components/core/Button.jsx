import React from "react";

const base = {
  cursor: "pointer",
  font: "500 13px var(--font-sans)",
  padding: "var(--pad-button)",
  borderRadius: "var(--radius-card)",
  transition: "opacity .15s ease, background .15s ease",
};

const variants = {
  primary: { background: "var(--ink)", color: "var(--bg)", border: "1px solid var(--ink)" },
  outline: { background: "transparent", color: "var(--ink)", border: "1px solid var(--line-2)" },
  ghost: { background: "transparent", color: "var(--ink-2)", border: "1px solid transparent" },
};

const hover = {
  primary: { opacity: 0.86 },
  outline: { background: "var(--surface-2)" },
  ghost: { color: "var(--ink)" },
};

/**
 * Primary action button in three weights. Solid `primary` for the
 * main action, `outline` for secondary, `ghost` for low-stakes (Skip).
 */
export function Button({ variant = "primary", onClick, disabled = false, children }) {
  const [h, setH] = React.useState(false);
  const v = variants[variant] || variants.primary;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        ...base,
        ...v,
        ...(h && !disabled ? hover[variant] : null),
        opacity: disabled ? 0.45 : h ? hover[variant]?.opacity ?? 1 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}
