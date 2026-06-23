import React from "react";
import { Badge } from "../../design-system/core/Badge.jsx";
import { AgentWorking } from "./AgentWorking.jsx";
import { ThreadRow } from "./ThreadRow.jsx";
import { BranchStatus } from "./BranchStatus.jsx";
import { JiraBanner } from "./JiraBanner.jsx";
import { StagedApprovalsBar } from "./StagedApprovalsBar.jsx";
import styles from "./PRCard.module.css";

const REVIEW = {
  READY: { tone: "active", label: "✓ ready to merge" },
  APPROVED: { tone: "active", label: "Approved" },
  REVIEW_REQUIRED: { tone: "neutral", label: "Review required" },
  DRAFT: { tone: "outline", label: "Draft" },
};
const PILL_TONE = { behind: "neutral", ci: "urgent" };

/**
 * The repeating PR unit, rendered for ONE lane. The daemon owns routing: it
 * decides this PR belongs in this lane and hands the card the exact `items` to
 * show here (server placements). The card is a PURE RENDERER — it never filters,
 * routes, or reorders, and it never touches the dashboard state hook: it gets the
 * data + `onX` callbacks it needs as plain props (thread items carry their own via
 * `threadProps`). A PR can appear in several lanes, each as its own card with its
 * own slice of items. Emphasis (accent rule + seal) is the Needs-you treatment only.
 *
 * `items` is an ordered list, each one of:
 *   { kind: 'agentWorking', text, tone?, pulse? }   ambient "agent working" line
 *   { kind: 'branch', branch:{ kind, details? } }   branch health (surfaced/outofsync/conflict)
 *   { kind: 'thread', thread, threadProps }          a reviewer comment thread + its handlers
 *   { kind: 'jira' }                                 missing-ticket compliance banner
 */
export function PRCard({
  pr,
  lane = "needs",
  items = [],
  stagedCount = 0,
  running = false,
  onRunAgent,
  branchDetailsOpen = false,
  onToggleBranchDetails,
  branchTerminalOpen = false,
  onBranchTerminal,
  jiraLinked = null,
  onSetTicket,
}) {
  const review = REVIEW[pr.review] || REVIEW.REVIEW_REQUIRED;
  const needsYou = lane === "needs";
  const staged = needsYou ? stagedCount : 0;

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
          <AgentWorking>{it.text}</AgentWorking>
        </div>
      ))}

      {branchItems.map((it, i) => {
        const b = it.branch;
        // Bind the adapter's semantic action keys to this card's branch handlers
        // (adapt.js is React-free, so it emits keys; the card wires the handlers).
        const actions = (b.actions || []).map((a) => ({
          label: a.label || "Open in terminal",
          // Forward a.kind (conflict/outOfSync) so the right terminal opener is picked,
          // not the default rebase one.
          onClick: () => onBranchTerminal(a.kind),
          note: branchTerminalOpen ? "Terminal session opened…" : undefined,
        }));
        return (
          <div key={`branch-${i}`} className={styles.section}>
            <BranchStatus
              tone={b.tone}
              pulse={b.pulse}
              message={b.message}
              details={b.details}
              detailsOpen={branchDetailsOpen}
              onToggleDetails={onToggleBranchDetails}
              actions={actions}
            />
          </div>
        );
      })}

      {threadItems.length > 0 && (
        <div className={styles.threads}>
          {threadItems.map((it) => (
            <ThreadRow key={it.thread.id} thread={it.thread} {...it.threadProps} />
          ))}
        </div>
      )}

      {hasJira && <JiraBanner linked={jiraLinked} onSetTicket={onSetTicket} />}

      {isEmpty && (
        <div className={styles.noThreads}>No open threads — waiting on the reviewer.</div>
      )}

      {needsYou && staged > 0 && (
        <div className={styles.staged}>
          <StagedApprovalsBar count={staged} running={running} onRun={onRunAgent} />
        </div>
      )}
    </div>
  );
}
