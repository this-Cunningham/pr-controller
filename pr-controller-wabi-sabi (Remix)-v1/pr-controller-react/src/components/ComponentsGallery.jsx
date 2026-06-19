import { useDashboard } from '../useDashboard.js';
import {
  GALLERY_SEED,
  EX_NEEDS,
  EX_CALM,
  EX_INPUT,
  GALLERY_ALL,
  GALLERY_CONFLICT,
  GALLERY_SURFACED,
  GALLERY_SYNC,
  GALLERY_JIRA,
  GALLERY_JIRA_SET,
} from '../data.js';
import { tagMeta } from '../meta.js';
import PRCard from './PRCard.jsx';
import ReviewPill from './ReviewPill.jsx';
import StatusPill from './StatusPill.jsx';
import ScopeBadge from './ScopeBadge.jsx';
import Skeleton from './Skeleton.jsx';
import EmptyState from './EmptyState.jsx';
import Toast from './Toast.jsx';

const mono = "'IBM Plex Mono', monospace";

function Frame({ title, caption, children }) {
  return (
    <div style={{ marginTop: 34 }}>
      <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{title}</div>
      {caption && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 4 }}>{caption}</div>}
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

const swatchBox = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 5,
  padding: 18,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 9,
};

function MiniHeader({ scope }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 5,
        padding: '16px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 20, fontWeight: 500, color: 'var(--ink)' }}>PR Controller</span>
        <ScopeBadge scope={scope} count={3} onToggle={() => {}} />
      </div>
      <span style={{ font: `500 12px ${mono}`, color: 'var(--ink-2)' }}>{scope === 'scoped' ? '3 open · 1 need you' : '7 open · 5 need you'}</span>
    </div>
  );
}

const cardStack = { display: 'flex', flexDirection: 'column', gap: 14 };

export default function ComponentsGallery() {
  // Its own seeded dashboard so staged / linked states show without clicks.
  const dash = useDashboard(GALLERY_SEED);

  return (
    <div>
      <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 24, fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>Component gallery</div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Every element and state. The cards below are live — try the controls.</div>

      <Frame title="Header bar · scope badge">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MiniHeader scope="all" />
          <MiniHeader scope="scoped" />
        </div>
      </Frame>

      <Frame title="Review &amp; signal pills">
        <div style={swatchBox}>
          <ReviewPill review="APPROVED" />
          <ReviewPill review="REVIEW_REQUIRED" />
          <ReviewPill review="DRAFT" />
          <StatusPill pill={{ label: 'behind base', kind: 'behind' }} />
          <StatusPill pill={{ label: 'CI failing: unit-api', kind: 'ci' }} />
        </div>
      </Frame>

      <Frame title="Thread disposition tags">
        <div style={swatchBox}>
          {Object.values(tagMeta).map((m) => (
            <span
              key={m.label}
              style={{
                fontFamily: mono,
                fontSize: 10.5,
                letterSpacing: '.07em',
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: 4,
                background: m.bg,
                color: m.fg,
                border: m.dashed ? '1px dashed var(--line-2)' : '1px solid transparent',
              }}
            >
              {m.label}
            </span>
          ))}
        </div>
      </Frame>

      <Frame title="PR card · needs you (emphasis)" caption="Accent rule + seal; the suggested reply pre-fills the textarea.">
        <PRCard pr={EX_NEEDS} tab="needs" dash={dash} />
      </Frame>

      <Frame title="PR card · in progress" caption="Quiet pulsing “agent working” cue; conflict resolving; “no feedback yet” threads.">
        <PRCard pr={EX_NEEDS} tab="progress" dash={dash} />
      </Frame>

      <Frame title="PR card · waiting on reviewer (calm)" caption="Addressed items, no actions.">
        <PRCard pr={EX_CALM} tab="waiting" dash={dash} />
      </Frame>

      <Frame title="Suggested approach · stage → Run agent" caption="Approve stages into a per-PR cart; Run agent fires one worker for everything staged.">
        <PRCard pr={EX_INPUT} tab="needs" dash={dash} />
      </Frame>

      <Frame title="One PR across tabs" caption="The unit is the ITEM — the same PR renders a different slice per tab.">
        <div style={cardStack}>
          <PRCard pr={GALLERY_ALL} tab="needs" dash={dash} />
          <PRCard pr={GALLERY_ALL} tab="progress" dash={dash} />
          <PRCard pr={GALLERY_ALL} tab="waiting" dash={dash} />
        </div>
      </Frame>

      <Frame title="Branch health · resolving (in progress)">
        <PRCard pr={GALLERY_CONFLICT} tab="progress" dash={dash} />
      </Frame>

      <Frame title="Branch health · surfaced + out of sync (needs you)" caption="Show-details expander and a terminal escape hatch.">
        <div style={cardStack}>
          <PRCard pr={GALLERY_SURFACED} tab="needs" dash={dash} />
          <PRCard pr={GALLERY_SYNC} tab="needs" dash={dash} />
        </div>
      </Frame>

      <Frame title="JIRA-needed banner" caption="Pending (top) and linked (bottom).">
        <div style={cardStack}>
          <PRCard pr={GALLERY_JIRA} tab="needs" dash={dash} />
          <PRCard pr={GALLERY_JIRA_SET} tab="needs" dash={dash} />
        </div>
      </Frame>

      <Frame title="Empty section · the calm ensō">
        <EmptyState label="Nothing needs you right now." />
      </Frame>

      <Frame title="Loading · first fetch">
        <Skeleton />
      </Frame>

      <Toast message={dash.toastMsg} />
    </div>
  );
}
