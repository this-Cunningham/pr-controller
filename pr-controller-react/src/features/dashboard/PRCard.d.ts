import * as React from "react";
import type { Thread, ThreadRowProps } from "./ThreadRow";

export type Lane = "needs" | "progress" | "waiting";

export interface BranchHealth {
  /** 'agent' = ambient pulsing status (a rebase running) → In progress; 'attention' = needs-you callout. */
  tone: "agent" | "attention";
  pulse?: boolean;
  message: React.ReactNode;
  /** Full reason, revealed by "Show details". */
  details?: React.ReactNode;
  /** Action keys the card binds to controller methods. */
  actions?: ("terminal" | "rebase")[];
}

/** Card metadata only — no routing fields; the card renders the `items` it's given. */
export interface PullRequestMeta {
  id: string;
  /** "repo" (display) */
  repo: string;
  number: number;
  title: string;
  url?: string;
  review: "READY" | "APPROVED" | "REVIEW_REQUIRED" | "DRAFT";
  /** Signal pills. kind: 'behind' (behind base) | 'ci' (CI failing). */
  pills?: { label: string; kind: "behind" | "ci" }[];
}

/** One render item for a card, already routed to this lane by the daemon. A thread
 * item carries its own presentational props (`threadProps`), wired by the parent. */
export type PRCardItem =
  | { kind: "agentWorking"; text: React.ReactNode; tone?: "agent" | "accent" | "ochre"; pulse?: boolean }
  | { kind: "branch"; branch: BranchHealth }
  | { kind: "thread"; thread: Thread; threadProps?: Omit<ThreadRowProps, "thread"> }
  | { kind: "jira" };

/** Pure renderer — data + `onX` callbacks as plain props; it never touches the state hook. */
export interface PRCardProps {
  pr: PullRequestMeta;
  /** Which lane this card renders in — drives emphasis only (needs = accent + seal). */
  lane?: Lane;
  /** The ordered items to render. The card does NOT filter or reorder them. */
  items?: PRCardItem[];
  /** Count of staged approaches in this PR's cart (Needs-you only). */
  stagedCount?: number;
  /** Whether a worker is currently running for this PR. */
  running?: boolean;
  onRunAgent?(): void;
  branchDetailsOpen?: boolean;
  onToggleBranchDetails?(): void;
  branchTerminalOpen?: boolean;
  onBranchTerminal?(kind?: string): void;
  /** Re-dispatch a run that came back without a usable result (the workerFailed card). */
  onBranchRerun?(): void;
  /** The linked JIRA ticket, or null when none is set. */
  jiraLinked?: string | null;
  /** Set the PR's ticket. Return false to reject (e.g. empty/invalid). */
  onSetTicket?(value: string): boolean | void;
}

/**
 * @startingPoint section="PR Controller" subtitle="PR card — pure per-lane renderer" viewport="640x400"
 */
export function PRCard(props: PRCardProps): JSX.Element;
