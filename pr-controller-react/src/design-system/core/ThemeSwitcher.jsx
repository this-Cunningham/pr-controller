import React from "react";
import styles from "./ThemeSwitcher.module.css";

const THEMES = [
  { value: "stone-dark", label: "Stone · Dark" },
  { value: "stone-light", label: "Stone · Light" },
  { value: "warm-dark", label: "Warm · Dark" },
  { value: "warm-light", label: "Warm · Light" },
  { value: "tea-dark", label: "Tea · Dark" },
  { value: "tea-light", label: "Tea · Light" },
];

/**
 * Runtime theme picker. Uncontrolled by default — it writes
 * `data-theme` onto <html>, which retints every token. Pass
 * `value` + `onChange` to control it externally.
 */
export function ThemeSwitcher({ value, onChange, themes = THEMES }) {
  const [internal, setInternal] = React.useState(
    () => (typeof document !== "undefined" && document.documentElement.dataset.theme) || "stone-dark"
  );
  const current = value ?? internal;

  const apply = (next) => {
    if (typeof document !== "undefined") document.documentElement.dataset.theme = next;
    if (value === undefined) setInternal(next);
    onChange && onChange(next);
  };

  return (
    <select
      value={current}
      onChange={(e) => apply(e.target.value)}
      aria-label="Theme"
      className={styles.select}
    >
      {themes.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );
}
