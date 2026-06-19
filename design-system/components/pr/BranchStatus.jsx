import React from "react";
import { Callout } from "../core/Callout.jsx";
import { Button } from "../core/Button.jsx";
import { TerminalNote } from "../feedback/TerminalNote.jsx";

const branchName = { fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--ink)" };
const ctaRow = { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 9 };

function Branch({ children }) {
  return <span style={branchName}>{children}</span>;
}

/**
 * PR-level branch-health status — distinct from per-thread actions.
 * Three states, each with the right Callout tone and CTAs:
 *   - "out-of-sync": the branch diverged and the agent couldn't
 *      fast-forward → Rebase branch / Resolve in terminal.
 *   - "working": the agent is applying approved changes (live, pulsing).
 *   - "suggested": the agent proposes an approach → Approve approach.
 * Pass handlers for the CTAs you want enabled.
 */
export function BranchStatus({
  state,
  branch = "feature branch",
  ahead = 0,
  behind = 0,
  detail,
  suggestion,
  resolving = false,
  rebasing = false,
  onRebase,
  onResolveTerminal,
  onApprove,
}) {
  if (state === "working") {
    return (
      <Callout tone="agent" eyebrow="Agent working" dot pulse>
        {detail || (
          <>
            Applying approved changes to <Branch>{branch}</Branch>…
          </>
        )}
      </Callout>
    );
  }

  if (state === "suggested") {
    return (
      <div>
        <Callout tone="quiet" eyebrow="Suggested approach">
          {suggestion || detail}
        </Callout>
        <div style={ctaRow}>
          <Button variant="primary" onClick={onApprove}>
            Approve approach
          </Button>
        </div>
      </div>
    );
  }

  // out-of-sync (default)
  return (
    <div>
      <Callout tone="urgency" eyebrow="Branch out of sync" dot>
        {detail || (
          <>
            <Branch>{branch}</Branch> has diverged from origin — {ahead} ahead, {behind} behind. The
            agent couldn’t fast-forward.
          </>
        )}
      </Callout>
      <div style={ctaRow}>
        <Button variant="primary" onClick={onRebase}>
          {rebasing ? "Rebasing…" : "Rebase branch"}
        </Button>
        <Button variant="outline" onClick={onResolveTerminal}>
          Resolve in terminal
        </Button>
      </div>
      {resolving && <TerminalNote>Terminal session opened — resolve the conflict there.</TerminalNote>}
    </div>
  );
}
