import * as React from "react";

/** One agent-drafted approach in the multi-approach variant (`input` threads). */
export interface Approach {
  /** Short label for the approach, e.g. "Keep the guard, add SSO above it". */
  title: string;
  /** The approach description. */
  body: string;
  /** Optional trade-off tag, e.g. "safest · +1 branch". */
  trade?: string;
  /** Optional drafted reply this approach pre-fills into the editable reply box. */
  reply?: string;
}

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
  /** `input` only: 1–3 agent-drafted approaches, rendered as selectable radio-cards.
   *  Supersedes the single `approach` when present; the picked one is what onApprove stages. */
  approaches?: Approach[];
  /** `input` only: an agent-drafted reply that pre-fills the (editable) reply box. */
  reply?: string;
}

/**
 * Presentational thread row. The thread's data plus its handlers + state arrive as
 * plain props, already bound to this (PR, thread) by the parent — no controller object,
 * no context.
 */
export interface ThreadRowProps {
  thread: Thread;
  /** `input` only: whether this thread's approach is staged into the PR's cart. */
  staged?: boolean;
  /** `input` only: whether a reply has been sent to the reviewer. */
  replySent?: boolean;
  /** `input` only: the text of the sent reply (shown when `replySent`). */
  sentReplyText?: string;
  /** Whether a terminal session is open for this thread. */
  terminalOpen?: boolean;
  /** Stage the approach. In the multi-approach variant the chosen index is passed. */
  onApprove?(approachIndex?: number): void;
  onUnstage?(): void;
  /** Send the (edited) reply. Return false to reject (e.g. empty input). */
  onSendReply?(text: string): boolean | void;
  onUndoReply?(): void;
  onDiscuss?(): void;
}

export function ThreadRow(props: ThreadRowProps): JSX.Element;
