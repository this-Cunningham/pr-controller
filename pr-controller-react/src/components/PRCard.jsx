import { useState } from 'react';
import ReviewPill from './ReviewPill.jsx';
import StatusPill from './StatusPill.jsx';
import ThreadRow from './ThreadRow.jsx';
import JiraBanner from './JiraBanner.jsx';
import Button from './Button.jsx';
import BranchStatus from './BranchStatus.jsx';
import { Callout } from '../design-system/components/core/Callout.jsx';
import { TerminalNote } from '../design-system/components/feedback/TerminalNote.jsx';
import { TextButton } from '../design-system/components/core/TextButton.jsx';

const mono = 'var(--font-mono)';

export default function PRCard({ pr, needsYou, inProgress = false, dash }) {
  const hasThreads = pr.threads.length > 0;
  const showNoThreads = !hasThreads && !pr.jira;
  const working = dash.prWorking ? dash.prWorking(pr.id) : false;
  // The "Agent working" pulse shows when a worker is actually in-flight for this
  // PR, OR on the In-progress tab's slice (where every item is, by definition,
  // the agent's to handle — a calm card with a sign the agent is on it).
  const showWorking = working || inProgress;
  // Branch-health "Resolve in terminal" opens a session keyed by the PR id (no
  // thread). It reads its OWN overlay store (branchHealthStatus), separate from the
  // thread-keyed one. Once opened, swap the CTA for the same ›_ note the rows use.
  const rebaseDiscussing = dash.branchHealthStatus ? dash.branchHealthStatus(pr.id) === 'discussing' : false;
  const stagedCount = dash.stagedFor ? dash.stagedFor(pr.id).length : 0;
  const [surfacedOpen, setSurfacedOpen] = useState(false);

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-card)',
        padding: '18px 20px 18px 22px',
        animation: 'ws-appear .3s ease',
      }}
    >
      {needsYou && (
        <>
          <div
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--accent)' }}
          />
          <div
            style={{
              position: 'absolute',
              top: 15,
              right: 15,
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: 'var(--accent)',
            }}
          />
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <a
            className="pr-link"
            href={pr.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-block',
              fontFamily: mono,
              fontSize: 12.5,
              color: 'var(--ink-2)',
              textDecoration: 'none',
              borderBottom: '1px solid var(--line-2)',
              paddingBottom: 1,
            }}
          >
            {pr.repo} #{pr.number}
          </a>
          <div
            style={{
              fontSize: 15.5,
              fontWeight: 600,
              lineHeight: 1.45,
              marginTop: 7,
              color: 'var(--ink)',
              textWrap: 'pretty',
            }}
          >
            {pr.title}
          </div>
        </div>
        <ReviewPill review={pr.review} />
      </div>

      {pr.surfaced && (
        <div style={{ marginTop: 12 }}>
          {/* Keep this calm: a one-line summary + a terminal escape hatch. The full
              (often paragraph-long) reason is tucked behind "Show details" — it's
              useful for debugging but shouldn't dominate the card. */}
          <Callout tone="urgency" eyebrow="Agent surfaced">
            Rebase too risky to do automatically — open a terminal to continue.
            <div style={{ marginTop: 6 }}>
              <TextButton tone="muted" onClick={() => setSurfacedOpen((v) => !v)}>
                {surfacedOpen ? 'Hide details' : 'Show details'}
              </TextButton>
            </div>
            {surfacedOpen && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                {pr.surfaced}
              </div>
            )}
          </Callout>
          {rebaseDiscussing ? (
            <TerminalNote>Terminal session opened — pick it up there.</TerminalNote>
          ) : (
            <div style={{ marginTop: 9 }}>
              <Button variant="outline" disabled={working} onClick={() => dash.discussRebase(pr.id, 'surfaced')}>
                ›_ Open in terminal
              </Button>
            </div>
          )}
        </div>
      )}

      {showWorking && (
        <div style={{ marginTop: 12 }}>
          <Callout tone="agent" dot pulse eyebrow="Agent working" />
        </div>
      )}

      {pr.pills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
          {pr.pills.map((pill, i) => (
            <StatusPill key={i} pill={pill} />
          ))}
        </div>
      )}

      {stagedCount > 0 && (
        <div style={{ marginTop: 12 }}>
          <Button variant="primary" disabled={working} onClick={() => dash.runAgent(pr.id)}>
            {working ? `Agent working… (${stagedCount} queued)` : `Run agent (${stagedCount})`}
          </Button>
        </div>
      )}

      {/* A merge conflict is handled by the agent's run (it rebases; if too risky it
          surfaces). Show the informational "resolving" status only while not already
          surfaced — once surfaced, the banner above owns the message. */}
      {pr.needsRebase && !pr.surfaced && stagedCount === 0 && (
        <BranchStatus kind="conflict" />
      )}

      {pr.outOfSync && !pr.needsRebase && (
        <BranchStatus
          kind="outOfSync"
          discussing={rebaseDiscussing}
          onResolveTerminal={() => dash.discussRebase(pr.id, 'outOfSync')}
        />
      )}

      {hasThreads && (
        <div style={{ marginTop: 14 }}>
          {pr.threads.map((t) => (
            <ThreadRow key={t.id} thread={t} prId={pr.id} dash={dash} />
          ))}
        </div>
      )}

      {showNoThreads && (
        <div
          style={{
            marginTop: 14,
            borderTop: '1px solid var(--line)',
            paddingTop: 13,
            fontSize: 12.5,
            color: 'var(--ink-3)',
            fontStyle: 'italic',
          }}
        >
          No open threads — waiting on the reviewer.
        </div>
      )}

      {pr.jira && <JiraBanner prId={pr.id} dash={dash} />}
    </div>
  );
}
