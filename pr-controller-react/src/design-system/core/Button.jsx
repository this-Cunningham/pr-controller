import React from "react";
import styles from "./Button.module.css";

const VARIANTS = ["primary", "outline", "ghost"];

/**
 * Primary action button in three weights. Solid `primary` for the
 * main action, `outline` for secondary, `ghost` for low-stakes (Skip).
 */
export function Button({ variant = "primary", onClick, disabled = false, children }) {
  const v = VARIANTS.includes(variant) ? variant : "primary";
  return (
    <button type="button" className={styles.btn} data-variant={v} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
