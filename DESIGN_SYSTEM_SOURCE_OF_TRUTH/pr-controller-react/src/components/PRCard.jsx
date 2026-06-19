import ReviewPill from './ReviewPill.jsx';
import StatusPill from './StatusPill.jsx';
import ThreadRow from './ThreadRow.jsx';
import BranchStatus from './BranchStatus.jsx';
import JiraBanner from './JiraBanner.jsx';
import StagedApprovalsBar from './StagedApprovalsBar.jsx';
import { TAG_TAB, BRANCH_TAB } from '../meta.js';

const mono = "'IBM Plex Mono', monospace";

// The repeating PR unit, rendered for ONE tab. The unit is the ITEM, so a
// single PR can appear in several tabs — each instance shows only the slice
// that routes to `tab`. Emphasis (accent rule + seal) is the Needs-you
// treatment only; the same PR is calm elsewhere.
export default function PRCard({ pr, tab, dash }) {
  const needsYou = tab === 'needs';
  const agentWorking = tab === 'progress';
  const threads = (pr.threads || []).filter((t) => TAG_TAB[t.tag] === tab);
  const branchShown = pr.branch && BRANCH_TAB[pr.branch.kind] === tab;
  const jiraShown = !!pr.jira && tab === 'needs';
  const staged = needsYou ? dash.stagedCount(pr.id, pr.threads) : 0;
  const showNoThreads = threads.length === 0 && !branchShown && !jiraShown && !agentWorking;

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 5,
        padding: '18px 20px 18px 22px',
        animation: 'appear .3s ease',
      }}
    >
      {needsYou && (
        <>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--accent)' }} />
          <div style={{ position: 'absolute', top: 15, right: 15, width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)' }} />
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <a
            className="pr-link"
            href="#"
            style={{ display: 'inline-block', fontFamily: mono, fontSize: 12.5, color: 'var(--ink-2)', textDecoration: 'none', borderBottom: '1px solid var(--line-2)', paddingBottom: 1 }}
          >
            {pr.repo} #{pr.number}
          </a>
          <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.45, marginTop: 7, color: 'var(--ink)', textWrap: 'pretty' }}>{pr.title}</div>
        </div>
        <ReviewPill review={pr.review} />
      </div>

      {pr.pills && pr.pills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
          {pr.pills.map((pill, i) => (
            <StatusPill key={i} pill={pill} />
          ))}
        </div>
      )}

      {agentWorking && (
        <div style={{ marginTop: 13, display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 6, background: 'var(--auto-bg)', color: 'var(--auto-fg)', fontSize: 12.5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', animation: 'pulse 1.8s ease-in-out infinite' }} />
          Agent working — addressing this PR now.
        </div>
      )}

      {branchShown && <BranchStatus pr={pr} dash={dash} />}

      {threads.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {threads.map((t) => (
            <ThreadRow key={t.id} thread={t} dash={dash} />
          ))}
        </div>
      )}

      {showNoThreads && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 13, fontSize: 12.5, color: 'var(--ink-3)', fontStyle: 'italic' }}>
          No open threads — waiting on the reviewer.
        </div>
      )}

      {jiraShown && <JiraBanner prId={pr.id} dash={dash} />}

      {needsYou && staged > 0 && (
        <StagedApprovalsBar count={staged} running={dash.running(pr.id)} onRun={() => dash.runAgent(pr.id, staged)} />
      )}
    </div>
  );
}
