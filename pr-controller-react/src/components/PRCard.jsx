import ReviewPill from './ReviewPill.jsx';
import StatusPill from './StatusPill.jsx';
import ThreadRow from './ThreadRow.jsx';
import JiraBanner from './JiraBanner.jsx';
import Button from './Button.jsx';
import BranchStatus from './BranchStatus.jsx';
import { Callout } from '../design-system/components/core/Callout.jsx';

const mono = 'var(--font-mono)';

export default function PRCard({ pr, needsYou, dash }) {
  const hasThreads = pr.threads.length > 0;
  const showNoThreads = !hasThreads && !pr.jira;
  const working = dash.prWorking ? dash.prWorking(pr.id) : false;
  // Branch-health "Resolve in terminal" opens a session keyed by the PR id (no
  // thread). Once opened, swap the CTA for the same ›_ note the thread rows use.
  const rebaseDiscussing = dash.threadStatus ? dash.threadStatus(pr.id) === 'discussing' : false;
  const stagedCount = dash.stagedFor ? dash.stagedFor(pr.id).length : 0;

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
          <Callout tone="urgency" eyebrow="Agent surfaced">{pr.surfaced}</Callout>
        </div>
      )}

      {working && (
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

      {pr.needsRebase && stagedCount === 0 && (
        <BranchStatus
          kind="conflict"
          surfaced={!!pr.surfaced}
          working={working}
          discussing={rebaseDiscussing}
          onRebase={() => dash.rebasePR(pr.id)}
          onResolveTerminal={() => dash.discussRebase(pr.id)}
        />
      )}

      {pr.outOfSync && !pr.needsRebase && (
        <BranchStatus
          kind="outOfSync"
          working={working}
          discussing={rebaseDiscussing}
          onResolveTerminal={() => dash.discussRebase(pr.id)}
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
