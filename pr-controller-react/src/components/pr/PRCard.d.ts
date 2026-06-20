import * as React from "react";
import type { PRController, Thread } from "./ThreadRow";

export type Lane = "needs" | "progress" | "waiting";

export interface BranchHealth {
  /** conflict (live rebase) → In progress · surfaced / outofsync / standing conflict → Needs you. */
  kind: "conflict" | "surfaced" | "outofsync";
  /** One-line override copy (e.g. a standing conflict's "resolve it here"). */
  detail?: React.ReactNode;
  /** Full reason behind a surfaced rebase ("Show details"). */
  details?: React.ReactNode;
}

/** Card metadata only — no routing fields; the card renders the `items` it's given. */
export interface PullRequestMeta {
  id: string;
  /** "repo" (display) */
  repo: string;
  number: number;
  title: string;
  url?: string;
  review: "APPROVED" | "REVIEW_REQUIRED" | "DRAFT";
  /** Signal pills. kind: 'behind' (behind base) | 'ci' (CI failing). */
  pills?: { label: string; kind: "behind" | "ci" }[];
}

/** One render item for a card, already routed to this lane by the daemon. */
export type PRCardItem =
  | { kind: "agentWorking"; text: React.ReactNode; tone?: "agent" | "accent" | "ochre"; pulse?: boolean }
  | { kind: "branch"; branch: BranchHealth }
  | { kind: "thread"; thread: Thread }
  | { kind: "jira" };

export interface PRCardProps {
  pr: PullRequestMeta;
  /** Which lane this card renders in — drives emphasis only (needs = accent + seal). */
  lane?: Lane;
  /** The ordered items to render. The card does NOT filter or reorder them. */
  items?: PRCardItem[];
  controller: PRController;
}

/**
 * @startingPoint section="PR Controller" subtitle="PR card — pure per-lane renderer" viewport="640x400"
 */
export function PRCard(props: PRCardProps): JSX.Element;
