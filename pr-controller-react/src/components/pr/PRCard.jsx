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

/** Disposition tag → tab, and branch kind → tab. praise routes nowhere. */
export const TAG_TAB = { input: "needs", error: "needs", pending: "progress", fixed: "waiting", waiting: "waiting", praise: null };
export const BRANCH_TAB = { conflict: "progress", surfaced: "needs", outofsync: "needs" };

/** Does this PR have at least one item routing to `tab`? */
export function prInTab(pr, tab) {
  const hasThread = (pr.threads || []).some((t) => TAG_TAB[t.tag] === tab);
  const hasBranch = pr.branch && BRANCH_TAB[pr.branch.kind] === tab;
  const hasJira = !!pr.jira && tab === "needs";
  return hasThread || hasBranch || hasJira;
}

/**
 * The repeating PR unit, rendered for ONE tab. The unit is the ITEM, so a
 * single PR can appear in several tabs — each instance shows only the
 * slice that routes to `tab`. Emphasis (accent rule + seal) is the
 * Needs-you treatment only; the same PR is calm elsewhere.
 */
export function PRCard({ pr, tab = "needs", controller }) {
  const review = REVIEW[pr.review] || REVIEW.REVIEW_REQUIRED;
  const needsYou = tab === "needs";
  const agentWorking = tab === "progress";
  const threads = (pr.threads || []).filter((t) => TAG_TAB[t.tag] === tab);
  const branchShown = pr.branch && BRANCH_TAB[pr.branch.kind] === tab;
  const jiraShown = !!pr.jira && tab === "needs";
  const staged = needsYou ? controller.stagedCount(pr.id) : 0;
  const showNoThreads = threads.length === 0 && !branchShown && !jiraShown && !agentWorking;

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

      {agentWorking && pr.progress && (
        <div className={styles.section}>
          <StatusLine align="center" tone={pr.progress.tone} pulse={pr.progress.pulse}>{pr.progress.text}</StatusLine>
        </div>
      )}

      {branchShown && (
        <div className={styles.section}>
          <BranchStatus
            state={pr.branch.kind}
            detail={pr.branch.detail}
            details={pr.branch.details}
            detailsOpen={controller.branchDetailsOpen(pr.id)}
            onToggleDetails={() => controller.toggleBranchDetails(pr.id)}
            terminalOpen={controller.branchTerminalOpen(pr.id)}
            onTerminal={() => controller.branchTerminal(pr.id)}
          />
        </div>
      )}

      {threads.length > 0 && (
        <div className={styles.threads}>
          {threads.map((t) => (
            <ThreadRow key={t.id} thread={t} controller={controller} />
          ))}
        </div>
      )}

      {showNoThreads && (
        <div className={styles.noThreads}>No open threads — waiting on the reviewer.</div>
      )}

      {jiraShown && <JiraBanner pr={pr} controller={controller} />}

      {needsYou && staged > 0 && (
        <div className={styles.staged}>
          <StagedApprovalsBar count={staged} running={controller.running(pr.id)} onRun={() => controller.runAgent(pr.id)} />
        </div>
      )}
    </div>
  );
}
