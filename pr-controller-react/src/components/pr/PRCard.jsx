import React from "react";
import { Badge } from "../core/Badge.jsx";
import { StatusLine } from "../feedback/StatusLine.jsx";
import { ThreadRow } from "./ThreadRow.jsx";
import { BranchStatus } from "./BranchStatus.jsx";
import { JiraBanner } from "./JiraBanner.jsx";
import { StagedApprovalsBar } from "./StagedApprovalsBar.jsx";
import styles from "./PRCard.module.css";

const REVIEW = {
  APPROVED: { tone: "sage", label: "Approved" },
  REVIEW_REQUIRED: { tone: "neutral", label: "Review required" },
  DRAFT: { tone: "outline", label: "Draft" },
};
const PILL_TONE = { behind: "neutral", ci: "accent" };

/**
 * The repeating PR unit, rendered for ONE lane. The daemon owns routing: it
 * decides this PR belongs in this lane and hands the card the exact `items` to
 * show here (server placements). The card is a PURE RENDERER — it never filters,
 * routes, or reorders. A PR can appear in several lanes, each as its own card with
 * its own slice of items. Emphasis (accent rule + seal) is the Needs-you treatment
 * only; the same PR is calm elsewhere.
 *
 * `items` is an ordered list, each one of:
 *   { kind: 'agentWorking', text, tone?, pulse? }   ambient "agent working" line
 *   { kind: 'branch', branch:{ kind, details? } }   branch health (surfaced/outofsync/conflict)
 *   { kind: 'thread', thread }                       a reviewer comment thread (DS Thread shape)
 *   { kind: 'jira' }                                 missing-ticket compliance banner
 */
export function PRCard({ pr, lane = "needs", items = [], controller }) {
  const review = REVIEW[pr.review] || REVIEW.REVIEW_REQUIRED;
  const needsYou = lane === "needs";
  const staged = needsYou ? controller.stagedCount(pr.id) : 0;

  // Bucket by kind for the canonical visual order (status → branch → threads →
  // jira). Membership and ordering within a kind are already decided upstream.
  const statusItems = items.filter((it) => it.kind === "agentWorking");
  const branchItems = items.filter((it) => it.kind === "branch");
  const threadItems = items.filter((it) => it.kind === "thread");
  const hasJira = items.some((it) => it.kind === "jira");
  const isEmpty = items.length === 0;

  return (
    <div className={`${styles.card} ws-appear`}>
      {needsYou && (
        <>
          <div className={styles.rule} />
          <div className={styles.seal} />
        </>
      )}

      <div className={styles.head}>
        <div className={styles.headMain}>
          <a href={pr.url || "#"} target={pr.url ? "_blank" : undefined} rel={pr.url ? "noreferrer" : undefined} className={styles.link}>
            {pr.repo} #{pr.number}
          </a>
          <div className={styles.title}>{pr.title}</div>
        </div>
        <Badge tone={review.tone} mono>{review.label}</Badge>
      </div>

      {pr.pills && pr.pills.length > 0 && (
        <div className={styles.pills}>
          {pr.pills.map((p, i) => (
            <Badge key={i} tone={PILL_TONE[p.kind] || "neutral"}>{p.label}</Badge>
          ))}
        </div>
      )}

      {statusItems.map((it, i) => (
        <div key={`status-${i}`} className={styles.section}>
          <StatusLine align="center" tone={it.tone || "agent"} pulse={it.pulse !== false}>{it.text}</StatusLine>
        </div>
      ))}

      {branchItems.map((it, i) => (
        <div key={`branch-${i}`} className={styles.section}>
          <BranchStatus
            state={it.branch.kind}
            detail={it.branch.detail}
            details={it.branch.details}
            detailsOpen={controller.branchDetailsOpen(pr.id)}
            onToggleDetails={() => controller.toggleBranchDetails(pr.id)}
            terminalOpen={controller.branchTerminalOpen(pr.id)}
            onTerminal={() => controller.branchTerminal(pr.id)}
          />
        </div>
      ))}

      {threadItems.length > 0 && (
        <div className={styles.threads}>
          {threadItems.map((it) => (
            <ThreadRow key={it.thread.id} thread={it.thread} controller={controller} />
          ))}
        </div>
      )}

      {hasJira && <JiraBanner pr={pr} controller={controller} />}

      {isEmpty && (
        <div className={styles.noThreads}>No open threads — waiting on the reviewer.</div>
      )}

      {needsYou && staged > 0 && (
        <div className={styles.staged}>
          <StagedApprovalsBar count={staged} running={controller.running(pr.id)} onRun={() => controller.runAgent(pr.id)} />
        </div>
      )}
    </div>
  );
}
