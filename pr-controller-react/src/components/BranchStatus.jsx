import { Callout } from '../design-system/components/core/Callout.jsx';
import { TerminalNote } from '../design-system/components/feedback/TerminalNote.jsx';
import Button from './Button.jsx';

// App-level branch-health status, mirroring the design system's BranchStatus
// composition but with the prop interface our backend actually produces. It is
// built from the same primitives (Callout / Button / TerminalNote) so it's
// visually and structurally the design-system component — only the state model
// differs:
//   - We split the design system's single "out-of-sync" into two real states:
//     `conflict` (merge conflict — needsRebase) and `outOfSync` (can't
//     fast-forward). Both reconcile in a terminal; conflict can also be rebased.
//   - When the agent ALREADY tried the rebase and surfaced it (`surfaced`),
//     retrying would just bail, so we suppress the Rebase button and offer only
//     the terminal hand-off — a deliberate behavior the mock's component lacks.
//
// `kind`: 'conflict' | 'outOfSync'. `discussing` shows the terminal note (the
// session was opened). Handlers: onRebase, onResolveTerminal.
const ctaRow = { display: 'flex', flexWrap: 'wrap', gap: 8 };

export default function BranchStatus({
  kind,
  surfaced = false,
  working = false,
  discussing = false,
  onRebase,
  onResolveTerminal,
}) {
  // A merge conflict can be auto-rebased in one click — UNLESS the agent already
  // tried and surfaced it (retrying just bails), in which case the only path is a
  // hand-resolve in a terminal. An out-of-sync branch is always hand-resolved.
  const rebaseable = kind === 'conflict' && !surfaced;

  if (discussing) {
    return (
      <TerminalNote>
        {kind === 'conflict'
          ? 'Terminal session opened — resolve the rebase there.'
          : 'Terminal session opened — reconcile the branch there.'}
      </TerminalNote>
    );
  }

  const hasBanner = kind === 'outOfSync';
  return (
    <div style={{ marginTop: 12 }}>
      {hasBanner && (
        <Callout tone="urgency" eyebrow="Branch out of sync">
          The branch diverged from the remote (a force-push or rebase), so the agent couldn’t
          fast-forward and didn’t run. Reconcile it in a terminal.
        </Callout>
      )}
      <div style={{ ...ctaRow, marginTop: hasBanner ? 12 : 0 }}>
        {rebaseable ? (
          <Button variant="outline" disabled={working} onClick={onRebase}>
            {working ? 'Rebasing…' : 'Rebase (merge conflict)'}
          </Button>
        ) : (
          <Button variant="outline" disabled={working} onClick={onResolveTerminal}>
            ›_ Resolve in terminal
          </Button>
        )}
      </div>
    </div>
  );
}
