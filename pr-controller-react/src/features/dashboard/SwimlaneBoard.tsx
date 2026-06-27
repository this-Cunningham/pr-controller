import { useEffect, useState } from 'react';
import Header from './Header.jsx';
import { PRCard } from './PRCard.jsx';
import type { PRCardItem } from './PRCard.d.ts';
import { Badge } from '../../design-system/core/Badge.jsx';
import type { BadgeProps } from '../../design-system/core/Badge.d.ts';
import { DispositionTag } from '../../design-system/core/DispositionTag.jsx';
import type { DispositionTagProps } from '../../design-system/core/DispositionTag.d.ts';
import { EmptyState } from '../../design-system/feedback/EmptyState.jsx';
import { Skeleton } from '../../design-system/feedback/Skeleton.jsx';
import { cardProps, wireItems } from './cardProps.js';
import type { DashApi } from './useDashboard.ts';
import type { Lane } from './wire.ts';
import styles from './SwimlaneBoard.module.css';

// ── Local view-model shapes (derived from DashApi; adapt.ts's lane element types
//    are not exported, so reach them through the hook's typed `lanes`). ──

/** One lane as the hook hands it over (key/title/prs). */
type LaneRender = DashApi['lanes'][number];
/** One PR card within a lane (meta + ordered render items). */
type LaneCard = LaneRender['prs'][number];
/** The card's PR metadata (repo/number/title/review/pills). */
type CardPr = LaneCard['pr'];
/** A single render item for a card (thread/branch/jira/agentWorking). */
type CardItem = LaneCard['items'][number];

/** The lead chip shown on a compact swimlane card. */
interface LeadChip {
  tone: DispositionTagProps['tone'];
  label: string;
  loc: string | null;
}

/** The expanded-modal selection (PR id + lane), or null when nothing is open. */
interface ExpandedSel {
  prId: string;
  lane: Lane;
}

/**
 * Swimlane board — the same server-authoritative lanes as the dashboard list view, shown
 * as three side-by-side columns of compact cards. It derives NO routing: it renders
 * `dash.lanes` (built by buildLanes from the daemon's placements) exactly as the list view
 * does. A card is a summary; clicking it opens the full interactive PRCard in a modal.
 * The Settings "Default view" toggle (useDashboard.viewMode) switches in and out of here.
 */

const CAPTION: Record<Lane, string> = {
  needs: 'Resolve these before the agent continues.',
  progress: 'The agent is working on these — just glance.',
  waiting: 'Addressed — waiting on the reviewer.',
};
const EMPTY: Record<Lane, string> = {
  needs: 'Nothing needs you right now.',
  progress: 'Nothing in progress.',
  waiting: 'Nothing waiting on a reviewer.',
};

// PR review state -> DS Badge. Mirrors the list view's header badge vocabulary.
const REVIEW: Record<CardPr['review'], { tone: BadgeProps['tone']; label: string }> = {
  READY: { tone: 'active', label: 'Ready' },
  APPROVED: { tone: 'active', label: 'Approved' },
  REVIEW_REQUIRED: { tone: 'neutral', label: 'Review required' },
  DRAFT: { tone: 'outline', label: 'Draft' },
};
const PILL_TONE: Record<'behind' | 'ci', BadgeProps['tone']> = { behind: 'neutral', ci: 'urgent' };

// One render item -> the lead DispositionTag chip for the compact card. Presentational
// summary only (the full items render in the expand modal's PRCard).
const TAG_CHIP: Record<string, { tone: DispositionTagProps['tone']; label: string }> = {
  input: { tone: 'urgent', label: 'needs your input' },
  error: { tone: 'error', label: 'agent error' },
  pending: { tone: 'pending', label: 'no feedback yet' },
  fixed: { tone: 'active', label: 'agent fixed · waiting' },
  waiting: { tone: 'neutral', label: 'waiting on reviewer' },
  praise: { tone: 'praise', label: 'praise' },
};
function itemChip(it: CardItem): LeadChip {
  if (it.kind === 'thread') return { ...(TAG_CHIP[it.thread.tag] || TAG_CHIP.waiting), loc: it.thread.loc || null };
  if (it.kind === 'branch') return it.branch.tone === 'agent'
    ? { tone: 'active', label: 'rebasing', loc: null }
    : { tone: 'urgent', label: 'branch needs you', loc: null };
  if (it.kind === 'agentWorking') return { tone: 'active', label: 'agent working', loc: null };
  if (it.kind === 'jira') return { tone: 'urgent', label: 'missing ticket', loc: null };
  return { tone: 'neutral', label: 'waiting on reviewer', loc: null };
}
function leadSummary(items: CardItem[]): { lead: LeadChip; more: number } {
  if (!items.length) return { lead: { tone: 'neutral', label: 'waiting on reviewer', loc: null }, more: 0 };
  return { lead: itemChip(items[0]), more: items.length - 1 };
}

interface SwimlaneCardProps {
  pr: CardPr;
  items: CardItem[];
  lane: Lane;
  stagedCount: number;
  running: boolean;
  onOpen: () => void;
}

function SwimlaneCard({ pr, items, lane, stagedCount, running, onOpen }: SwimlaneCardProps) {
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

export default function SwimlaneBoard({ dash }: { dash: DashApi }) {
  const [expanded, setExpanded] = useState<ExpandedSel | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const lanes = dash.lanes;
  // Re-resolve the expanded card from live lanes each render, so it stays fresh on poll
  // (and closes itself if the PR leaves the board).
  const expandedLane: LaneRender | null | undefined = expanded && lanes.find((l) => l.key === expanded.lane);
  const expandedCard: LaneCard | undefined = expandedLane ? expandedLane.prs.find((c) => c.pr.id === expanded!.prId) : undefined;

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
              {/* `expandedCard` is only set when `expandedLane`/`expanded` were found this
                  render (see derivation above), so both are non-null in this branch. */}
              <span className={styles.modalEyebrow}>{expandedLane!.title}</span>
              <button type="button" className={styles.modalClose} onClick={() => setExpanded(null)} aria-label="Close">
                Close <span className={styles.kbd}>esc</span>
              </button>
            </div>
            <PRCard
              pr={expandedCard.pr}
              lane={expanded!.lane}
              // wireItems passes the adapter's lane items through (stamping threadProps on
              // thread items) and is typed to PRCardItem[]. adapt.ts's LaneItem and the
              // frozen PRCard.d.ts's PRCardItem are parallel contracts owned elsewhere; the
              // list view (App.jsx) hands over the same value untyped. Cast at this boundary
              // — see notes.
              items={wireItems(dash, expandedCard.pr.id, expandedCard.items as PRCardItem[])}
              {...cardProps(dash, expandedCard.pr.id)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
