import React from "react";
import { Badge } from "../core/Badge.jsx";
import { ThreadRow } from "./ThreadRow.jsx";
import { JiraBanner } from "./JiraBanner.jsx";

const mono = "var(--font-mono)";

const REVIEW = {
  APPROVED: { tone: "sage", label: "Approved" },
  REVIEW_REQUIRED: { tone: "neutral", label: "Review required" },
  DRAFT: { tone: "outline", label: "Draft" },
};

const PILL_TONE = { auto: "neutral", behind: "neutral", ci: "accent" };

/**
 * The repeating PR unit. Composes Badge (review + signals), ThreadRow,
 * and JiraBanner. `needsYou` adds the accent rule + seal for urgent cards.
 */
export function PRCard({ pr, needsYou = false, controller }) {
  const review = REVIEW[pr.review] || REVIEW.REVIEW_REQUIRED;
  const hasThreads = pr.threads && pr.threads.length > 0;
  const showNoThreads = !hasThreads && !pr.jira;

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
          <a href="#" style={{ display: "inline-block", fontFamily: mono, fontSize: 12.5, color: "var(--ink-2)", textDecoration: "none", borderBottom: "1px solid var(--line-2)", paddingBottom: 1 }}>
            {pr.repo} #{pr.number}
          </a>
          <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.45, marginTop: 7, color: "var(--ink)", textWrap: "pretty" }}>{pr.title}</div>
        </div>
        <Badge tone={review.tone} mono>{review.label}</Badge>
      </div>

      {pr.pills && pr.pills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
          {pr.pills.map((p, i) => (
            <Badge key={i} tone={PILL_TONE[p.kind] || "neutral"} dot={p.kind === "auto"}>
              {p.label}
            </Badge>
          ))}
        </div>
      )}

      {hasThreads && (
        <div style={{ marginTop: 14 }}>
          {pr.threads.map((t) => (
            <ThreadRow key={t.id} thread={t} controller={controller} />
          ))}
        </div>
      )}

      {showNoThreads && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 13, fontSize: 12.5, color: "var(--ink-3)", fontStyle: "italic" }}>
          No open threads — waiting on the reviewer.
        </div>
      )}

      {pr.jira && <JiraBanner pr={pr} controller={controller} />}
    </div>
  );
}
