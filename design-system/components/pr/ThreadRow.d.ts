import * as React from "react";

export type ThreadStatus = "pending" | "approved" | "skipped" | "discussing" | "rebutted";

export interface Thread {
  id: string;
  /** Agent disposition. */
  tag: "hashout" | "agree" | "waiting" | "praise" | "error";
  /** File location, e.g. "src/auth/middleware.ts:88". */
  loc: string;
  /** Reviewer handle, e.g. "@dana-k". */
  author: string;
  body: string;
  /** One-line rationale for the agent's classification. */
  reason: string;
}

/** Stateful controller the PR components delegate to (e.g. the dashboard hook). */
export interface PRController {
  threadStatus(id: string): ThreadStatus;
  threadRebuttal(id: string): string;
  approve(id: string): void;
  skip(id: string): void;
  discuss(id: string): void;
  undo(id: string): void;
  /** Return false to reject (e.g. empty input). */
  sendRebuttal(id: string, text: string): boolean | void;
  jiraValue(prId: string): string | null;
  setTicket(prId: string, value: string): boolean | void;
}

export interface ThreadRowProps {
  thread: Thread;
  controller: PRController;
}

export function ThreadRow(props: ThreadRowProps): JSX.Element;
