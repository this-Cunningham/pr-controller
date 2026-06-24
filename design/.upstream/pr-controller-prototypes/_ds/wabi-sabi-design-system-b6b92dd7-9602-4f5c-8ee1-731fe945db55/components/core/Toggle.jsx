import React from "react";

/**
 * Binary on/off switch. Controlled via `checked` + `onChange`, or
 * left uncontrolled (manages its own state). `disabled` renders a
 * de-emphasized dashed track that ignores input. The "on" track uses
 * the sage auto-fg; "off" is a quiet filled surface with a hairline.
 */
export function Toggle({ checked, defaultChecked = false, onChange, disabled = false, label, id }) {
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
    on: { background: "var(--auto-fg)", border: "1px solid var(--auto-fg)" },
    off: { background: "var(--surface-2)", border: "1px solid var(--line-2)" },
    disabled: { background: "transparent", border: "1px dashed var(--line-2)" },
  }[state];

  const knob = {
    on: { left: 19, background: "var(--bg)", boxShadow: "var(--shadow-1, 0 1px 2px rgba(0,0,0,.18))" },
    off: { left: 3, background: "var(--ink-3)", boxShadow: "var(--shadow-1, 0 1px 2px rgba(0,0,0,.18))" },
    disabled: { left: 3, background: "var(--line-2)", boxShadow: "none" },
  }[state];

  const sw = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={on}
      aria-disabled={disabled || undefined}
      onClick={toggle}
      style={{
        position: "relative",
        width: 38,
        height: 22,
        flex: "none",
        padding: 0,
        borderRadius: 999,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "background .18s ease, border-color .18s ease",
        ...track,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          transition: "left .18s ease",
          ...knob,
        }}
      />
    </button>
  );

  if (!label) return sw;

  return (
    <label
      htmlFor={id}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        font: "500 13px var(--font-sans)",
        color: disabled ? "var(--ink-3)" : "var(--ink-2)",
      }}
    >
      {sw}
      {label}
    </label>
  );
}
