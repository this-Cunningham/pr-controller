import * as React from "react";

export interface ThemeOption {
  value: string;
  label: string;
}

export interface ThemeSwitcherProps {
  /** Controlled value (one of the six theme keys). Omit to run uncontrolled. */
  value?: string;
  /** Called with the new theme key on change. */
  onChange?: (theme: string) => void;
  /** Override the theme list. */
  themes?: ThemeOption[];
}

export function ThemeSwitcher(props: ThemeSwitcherProps): JSX.Element;
