import { useEffect, useState } from 'react';
import Header from './Header.jsx';
import { PRCard } from './PRCard.jsx';
import { Badge } from '../../design-system/core/Badge.jsx';
import { DispositionTag } from '../../design-system/core/DispositionTag.jsx';
import { EmptyState } from '../../design-system/feedback/EmptyState.jsx';
import { Skeleton } from '../../design-system/feedback/Skeleton.jsx';
import { cardProps, wireItems } from './cardProps.js';
import styles from './SwimlaneBoard.module.css';

/**
 * Swimlane board — the same server-authoritative lanes as the dashboard list view, shown
 * as three side-by-side columns of compact cards. It derives NO routing: it renders
 * `dash.lanes` (built by buildLanes from the daemon's placements) exactly as the list view
 * does. A card is a summary; clicking it opens the full interactive PRCard in a modal.
 * The Settings "Default view" toggle (useDashboard.viewMode) switches in and out of here.
 */

const CAPTION = {
  needs: 'Resolve these before the agent continues.',
  progress: 'The agent is working on these — just glance.',
  waiting: 'Addressed — waiting on the reviewer.',
};
const EMPTY = {
  needs: 'Nothing needs you right now.',
  progress: 'Nothing in progress.',
  waiting: 'Nothing waiting on a reviewer.',
};

// PR review state -> DS Badge. Mirrors the list view's header badge vocabulary.
const REVIEW = {
  READY: { tone: 'active', label: 'Ready' },
  APPROVED: { tone: 'active', label: 'Approved' },
  REVIEW_REQUIRED: { tone: 'neutral', label: 'Review required' },
  DRAFT: { tone: 'outline', label: 'Draft' },
};
const PILL_TONE = { behind: 'neutral', ci: 'urgent' };

// One render item -> the lead DispositionTag chip for the compact card. Presentational
// summary only (the full items render in the expand modal's PRCard).
const TAG_CHIP = {
  input: { tone: 'urgent', label: 'needs your input' },
  error: { tone: 'error', label: 'agent error' },
  pending: { tone: 'pending', label: 'no feedback yet' },
  fixed: { tone: 'active', label: 'agent fixed · waiting' },
  waiting: { tone: 'neutral', label: 'waiting on reviewer' },
  praise: { tone: 'praise', label: 'praise' },
};
function itemChip(it) {
  if (it.kind === 'thread') return { ...(TAG_CHIP[it.thread.tag] || TAG_CHIP.waiting), loc: it.thread.loc || null };
  if (it.kind === 'branch') return it.branch.tone === 'agent'
    ? { tone: 'active', label: 'rebasing', loc: null }
    : { tone: 'urgent', label: 'branch needs you', loc: null };
  if (it.kind === 'agentWorking') return { tone: 'active', label: 'agent working', loc: null };
  if (it.kind === 'jira') return { tone: 'urgent', label: 'missing ticket', loc: null };
  return { tone: 'neutral', label: 'waiting on reviewer', loc: null };
}
function leadSummary(items) {
  if (!items.length) return { lead: { tone: 'neutral', label: 'waiting on reviewer', loc: null }, more: 0 };
  return { lead: itemChip(items[0]), more: items.length - 1 };
}

function SwimlaneCard({ pr, items, lane, stagedCount, running, onOpen }) {
  const review = REVIEW[pr.review] || REVIEW.REVIEW_REQUIRED;
  const { lead, more } = leadSummary(items);
  const showStaged = stagedCount > 0 || running;
  return (
    <button type="button" className={styles.card} data-needs={lane === 'needs' || undefined} onClick={onOpen}>
      <div className={styles.cardTop}>
        <span className={styles.cardRepo}>{pr.repo} #{pr.number}</span>
        <Badge tone={review.tone} mono>{review.label}</Badge>
      </div>
      <div className={styles.cardTitle}>{pr.title}</div>
      {pr.pills?.length > 0 && (
        <div className={styles.cardPills}>
          {pr.pills.map((p, i) => <Badge key={i} tone={PILL_TONE[p.kind] || 'neutral'}>{p.label}</Badge>)}
        </div>
      )}
      <div className={styles.cardFoot}>
        <DispositionTag tone={lead.tone}>{lead.label}</DispositionTag>
        {lead.loc && <span className={styles.cardLoc}>{lead.loc}</span>}
        {more > 0 && <span className={styles.cardMore}>+{more} more</span>}
      </div>
      {showStaged && (
        <div className={styles.cardStaged} data-running={running || undefined}>
          <span className={`${styles.cardStagedDot}${running ? ' ws-pulse' : ''}`} aria-hidden="true" />
          {running ? 'Agent run started' : `${stagedCount} approach${stagedCount === 1 ? '' : 'es'} staged`}
        </div>
      )}
    </button>
  );
}

export default function SwimlaneBoard({ dash }) {
  const [expanded, setExpanded] = useState(null); // { prId, lane } | null

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setExpanded(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const lanes = dash.lanes;
  // Re-resolve the expanded card from live lanes each render, so it stays fresh on poll
  // (and closes itself if the PR leaves the board).
  const expandedLane = expanded && lanes.find((l) => l.key === expanded.lane);
  const expandedCard = expandedLane && expandedLane.prs.find((c) => c.pr.id === expanded.prId);

  return (
    <div className={styles.board}>
      <div className={styles.boardHead}>
        <Header dash={dash} />
      </div>

      <div className={styles.columns}>
        {lanes.map((lane) => {
          const accent = lane.key === 'needs' && lane.prs.length > 0;
          return (
            <section key={lane.key} className={styles.col}>
              <div className={styles.colHead} data-accent={accent || undefined}>
                <div className={styles.colTitleRow}>
                  <h2 className={styles.colTitle}>{lane.title}</h2>
                  <span className={styles.colCount} data-accent={accent || undefined}>{lane.prs.length}</span>
                </div>
                <div className={styles.colCaption}>{CAPTION[lane.key]}</div>
              </div>
              <div className={styles.colCards}>
                {dash.loading ? (
                  <Skeleton caption="Loading…" count={2} />
                ) : lane.prs.length === 0 ? (
                  <EmptyState label={EMPTY[lane.key]} />
                ) : (
                  lane.prs.map(({ pr, items }) => (
                    <SwimlaneCard
                      key={pr.id}
                      pr={pr}
                      items={items}
                      lane={lane.key}
                      stagedCount={dash.stagedFor(pr.id).length}
                      running={dash.prWorking(pr.id)}
                      onOpen={() => setExpanded({ prId: pr.id, lane: lane.key })}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {expandedCard && (
        <div className={styles.backdrop} onClick={() => setExpanded(null)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label={expandedCard.pr.title}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <span className={styles.modalEyebrow}>{expandedLane.title}</span>
              <button type="button" className={styles.modalClose} onClick={() => setExpanded(null)} aria-label="Close">
                Close <span className={styles.kbd}>esc</span>
              </button>
            </div>
            <PRCard
              pr={expandedCard.pr}
              lane={expanded.lane}
              items={wireItems(dash, expandedCard.pr.id, expandedCard.items)}
              {...cardProps(dash, expandedCard.pr.id)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
