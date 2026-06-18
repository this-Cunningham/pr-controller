import * as React from "react";
import type { PRController, Thread } from "./ThreadRow";

export interface PullRequest {
  id: string;
  /** "owner/repo" */
  repo: string;
  number: number;
  title: string;
  review: "APPROVED" | "REVIEW_REQUIRED" | "DRAFT";
  /** Whether the missing-ticket compliance banner applies. */
  jira?: boolean;
  /** Signal pills. kind: 'auto' (N auto-fixable) | 'behind' | 'ci'. */
  pills?: { label: string; kind: "auto" | "behind" | "ci" }[];
  threads?: Thread[];
}

export interface PRCardProps {
  pr: PullRequest;
  /** Adds the accent rule + seal for "needs you" cards. */
  needsYou?: boolean;
  controller: PRController;
}

/**
 * @startingPoint section="PR Controller" subtitle="PR card with threads & actions" viewport="640x360"
 */
export function PRCard(props: PRCardProps): JSX.Element;
