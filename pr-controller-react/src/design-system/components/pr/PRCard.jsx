import React from "react";
import { Badge } from "../core/Badge.jsx";
import { Callout } from "../core/Callout.jsx";
import { ThreadRow } from "./ThreadRow.jsx";
import { BranchStatus } from "./BranchStatus.jsx";
import { JiraBanner } from "./JiraBanner.jsx";
import { StagedApprovalsBar } from "./StagedApprovalsBar.jsx";

const mono = "var(--font-mono)";

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
    <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-card)", padding: "18px 20px 18px 22px", animation: "ws-appear .3s ease" }}>
      {needsYou && (
        <>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "var(--accent)" }} />
          <div style={{ position: "absolute", top: 15, right: 15, width: 9, height: 9, borderRadius: "50%", background: "var(--accent)" }} />
        </>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <a href={pr.url || "#"} target={pr.url ? "_blank" : undefined} rel={pr.url ? "noreferrer" : undefined} style={{ display: "inline-block", fontFamily: mono, fontSize: 12.5, color: "var(--ink-2)", textDecoration: "none", borderBottom: "1px solid var(--line-2)", paddingBottom: 1 }}>
            {pr.repo} #{pr.number}
          </a>
          <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.45, marginTop: 7, color: "var(--ink)", textWrap: "pretty" }}>{pr.title}</div>
        </div>
        <Badge tone={review.tone} mono>{review.label}</Badge>
      </div>

      {pr.pills && pr.pills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
          {pr.pills.map((p, i) => (
            <Badge key={i} tone={PILL_TONE[p.kind] || "neutral"}>{p.label}</Badge>
          ))}
        </div>
      )}

      {agentWorking && (
        <div style={{ marginTop: 13 }}>
          <Callout tone="agent" dot pulse>Agent working — addressing this PR now.</Callout>
        </div>
      )}

      {branchShown && (
        <div style={{ marginTop: 13 }}>
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
        <div style={{ marginTop: 14 }}>
          {threads.map((t) => (
            <ThreadRow key={t.id} thread={t} controller={controller} />
          ))}
        </div>
      )}

      {showNoThreads && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 13, fontSize: 12.5, color: "var(--ink-3)", fontStyle: "italic" }}>
          No open threads — waiting on the reviewer.
        </div>
      )}

      {jiraShown && <JiraBanner pr={pr} controller={controller} />}

      {needsYou && staged > 0 && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 13 }}>
          <StagedApprovalsBar count={staged} running={controller.running(pr.id)} onRun={() => controller.runAgent(pr.id)} />
        </div>
      )}
    </div>
  );
}
