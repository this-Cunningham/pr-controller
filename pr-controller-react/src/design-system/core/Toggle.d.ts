import * as React from 'react';

export interface ToggleProps {
  /** Controlled on/off state. Omit to run uncontrolled. */
  checked?: boolean;
  /** Initial state when uncontrolled. */
  defaultChecked?: boolean;
  /** Fires with the next boolean value on user toggle. */
  onChange?: (next: boolean) => void;
  /** De-emphasized, non-interactive (dashed track). */
  disabled?: boolean;
  /** Optional trailing text label; renders the switch inside a <label>. */
  label?: React.ReactNode;
  /** id for the control, linking an external label. */
  id?: string;
  /** Accessible name for a label-less switch (local a11y add — applied only when `label` is absent). */
  ariaLabel?: string;
}

export function Toggle(props: ToggleProps): JSX.Element;
