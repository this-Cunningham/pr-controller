import { Callout } from '../design-system/components/core/Callout.jsx';
import { TerminalNote } from '../design-system/components/feedback/TerminalNote.jsx';
import Button from './Button.jsx';

// App-level branch-health status, built from the design system's primitives
// (Callout / TerminalNote). Two states:
//   - `conflict` (merge conflict — needsRebase): the agent ALWAYS attempts the
//     rebase as part of its run (Phase E — one worker per PR handles threads + the
//     rebase together). So this is purely INFORMATIONAL: "the agent is rebasing
//     this." If the rebase turns out too risky, the agent surfaces it and the PR
//     floats to "Needs you" (the surfaced banner) — there is no manual rebase
//     button to press here.
//   - `outOfSync` (branch can't fast-forward): the agent never ran, so this needs
//     a hand-resolve in a terminal.
//
// `kind`: 'conflict' | 'outOfSync'. `discussing` shows the terminal note (the
// session was opened). Handler: onResolveTerminal (outOfSync only).
export default function BranchStatus({
  kind,
  discussing = false,
  onResolveTerminal,
}) {
  if (kind === 'conflict') {
    // Informational only — the agent rebases as part of its run; no user action.
    return (
      <div style={{ marginTop: 12 }}>
        <Callout tone="agent" dot pulse eyebrow="Resolving merge conflict">
          The agent is rebasing this onto the latest base. If it can’t resolve the
          conflict safely, it’ll surface it for you.
        </Callout>
      </div>
    );
  }

  // outOfSync
  if (discussing) {
    return <TerminalNote>Terminal session opened — reconcile the branch there.</TerminalNote>;
  }
  return (
    <div style={{ marginTop: 12 }}>
      <Callout tone="urgency" eyebrow="Branch out of sync">
        Branch diverged from the remote — open a terminal to reconcile.
      </Callout>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <Button variant="outline" onClick={onResolveTerminal}>
          ›_ Resolve in terminal
        </Button>
      </div>
    </div>
  );
}
