import * as React from "react";
import type { PRController, Thread } from "./ThreadRow";

export interface BranchHealth {
  /** conflict → In progress · surfaced / outofsync → Needs you. */
  kind: "conflict" | "surfaced" | "outofsync";
  /** Override the default one-line copy. */
  detail?: React.ReactNode;
  /** Full reason behind a surfaced rebase ("Show details"). */
  details?: React.ReactNode;
}

export interface PullRequest {
  id: string;
  /** "owner/repo" */
  repo: string;
  number: number;
  title: string;
  /** Permalink to the PR; the repo/#number renders as a link when present. */
  url?: string;
  review: "APPROVED" | "REVIEW_REQUIRED" | "DRAFT";
  /** Missing-ticket compliance banner (routes to Needs you). */
  jira?: boolean;
  /** Signal pills. kind: 'behind' (behind base) | 'ci' (CI failing). */
  pills?: { label: string; kind: "behind" | "ci" }[];
  /** PR-level branch health (routes by kind). */
  branch?: BranchHealth;
  threads?: Thread[];
}

export type Tab = "needs" | "progress" | "waiting";

export interface PRCardProps {
  pr: PullRequest;
  /** Which tab this instance renders — only items routing here are shown. */
  tab?: Tab;
  controller: PRController;
}

/** Disposition tag → tab; branch kind → tab. */
export const TAG_TAB: Record<string, Tab | null>;
export const BRANCH_TAB: Record<string, Tab>;
/** Whether a PR has at least one item routing to `tab`. */
export function prInTab(pr: PullRequest, tab: Tab): boolean;

/**
 * @startingPoint section="PR Controller" subtitle="PR card — per-tab item slice" viewport="640x400"
 */
export function PRCard(props: PRCardProps): JSX.Element;
