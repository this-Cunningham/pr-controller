import * as React from "react";

export interface TabItem {
  key: string;
  label: string;
  /** Optional count chip. */
  count?: number;
  /** Render the count chip in accent when count > 0 (draws attention). */
  emphasize?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  /** Stick to the top of the scroll container (default true). */
  sticky?: boolean;
}

/**
 * @startingPoint section="Navigation" subtitle="Sticky section tabs with counts" viewport="700x60"
 */
export function Tabs(props: TabsProps): JSX.Element;
