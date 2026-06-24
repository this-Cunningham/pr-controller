import React from 'react';
import styles from './Toggle.module.css';

/**
 * Binary on/off switch for a single, self-applying setting. Controlled via
 * `checked` + `onChange`, or left uncontrolled (`defaultChecked`). Three states:
 * **on** (sage track), **off** (quiet filled surface + hairline), **disabled**
 * (dashed track, ignores input). Pass `label` for the common switch-plus-text row.
 *
 * For a choice the user must confirm, use a Button pair instead. One toggle = one
 * setting — don't group several as a substitute for a multi-select.
 */
export function Toggle({ checked, defaultChecked = false, onChange, disabled = false, label, id, ariaLabel }) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(defaultChecked);
  const on = isControlled ? checked : internal;

  const toggle = () => {
    if (disabled) return;
    const next = !on;
    if (!isControlled) setInternal(next);
    onChange && onChange(next);
  };

  const state = disabled ? 'disabled' : on ? 'on' : 'off';

  const sw = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={on}
      aria-label={!label ? ariaLabel : undefined}
      aria-disabled={disabled || undefined}
      onClick={toggle}
      className={styles.track}
      data-state={state}
    >
      <span className={styles.knob} data-state={state} />
    </button>
  );

  if (!label) return sw;

  return (
    <label htmlFor={id} className={styles.label} data-disabled={disabled || undefined}>
      {sw}
      {label}
    </label>
  );
}
