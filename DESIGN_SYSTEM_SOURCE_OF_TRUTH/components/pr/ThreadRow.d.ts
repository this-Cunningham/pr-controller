import * as React from "react";

export interface Thread {
  id: string;
  /** Agent disposition. Routes the item to a tab:
   *  input/error → Needs you · pending → In progress · fixed/waiting → Waiting · praise → none. */
  tag: "input" | "fixed" | "waiting" | "pending" | "praise" | "error";
  /** File location, e.g. "src/auth/middleware.ts:88". */
  loc: string;
  /** Reviewer handle, e.g. "@dana-k". */
  author: string;
  body: string;
  /** One-line rationale shown inline. */
  reasonSummary: string;
  /** Full rationale revealed by "Show agent's reasoning" (falls back to the summary). */
  reasonFull?: string;
  /** `input` only: an agent-drafted code approach. Approving stages it into the PR cart. */
  approach?: string;
  /** `input` only: an agent-drafted reply that pre-fills the (editable) reply box. */
  reply?: string;
}

/** Stateful controller the PR components delegate to (e.g. the dashboard hook). */
export interface PRController {
  // needs-your-input thread
  approachStaged(id: string): boolean;
  approveApproach(id: string): void;
  unstageApproach(id: string): void;
  replySent(id: string): boolean;
  replyText(id: string): string;
  /** Return false to reject (e.g. empty input). */
  sendReply(id: string, text: string): boolean | void;
  undoReply(id: string): void;
  discuss(id: string): void;
  threadTerminalOpen(id: string): boolean;
  // per-PR staged-approval cart
  stagedCount(prId: string): number;
  running(prId: string): boolean;
  runAgent(prId: string): void;
  // branch health
  branchDetailsOpen(prId: string): boolean;
  toggleBranchDetails(prId: string): void;
  branchTerminalOpen(prId: string): boolean;
  branchTerminal(prId: string): void;
  // jira
  jiraValue(prId: string): string | null;
  setTicket(prId: string, value: string): boolean | void;
}

export interface ThreadRowProps {
  thread: Thread;
  controller: PRController;
}

export function ThreadRow(props: ThreadRowProps): JSX.Element;
