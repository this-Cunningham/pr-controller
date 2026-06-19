import { useDashboard } from '../useDashboard.js';
import {
  GALLERY_SEED,
  EX_NEEDS,
  EX_CALM,
  EX_DENSE,
  EX_NONE,
  GALLERY_ALL,
  GALLERY_TAKEN,
  GALLERY_JIRA,
  GALLERY_JIRA_SET,
} from '../data.js';
import { tagMeta } from '../meta.js';
import { DispositionTag } from '../design-system/components/core/DispositionTag.jsx';
import PRCard from './PRCard.jsx';
import ReviewPill from './ReviewPill.jsx';
import StatusPill from './StatusPill.jsx';
import ScopeBadge from './ModeBadge.jsx';
import Skeleton from './Skeleton.jsx';
import EmptyState from './EmptyState.jsx';
import Toast from './Toast.jsx';

const mono = 'var(--font-mono)';

function Frame({ title, caption, children }) {
  return (
    <div style={{ marginTop: 34 }}>
      <div
        style={{
          fontFamily: mono,
          fontSize: 11,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        {title}
      </div>
      {caption && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 4 }}>{caption}</div>}
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

const swatchBox = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-card)',
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
        borderRadius: 'var(--radius-card)',
        padding: '16px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500, color: 'var(--ink)' }}>
          PR Controller
        </span>
        <ScopeBadge scope={scope} onExplain={() => {}} />
      </div>
      <span style={{ font: `500 12px ${mono}`, color: 'var(--ink-2)' }}>6 open · 2 need you</span>
    </div>
  );
}

export default function ComponentsGallery() {
  // Its own seeded dashboard so confirmation/linked states show without clicks.
  const dash = useDashboard(GALLERY_SEED);

  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 24,
          fontWeight: 500,
          color: 'var(--ink)',
          marginBottom: 6,
        }}
      >
        Component gallery
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
        Every element and state. The cards below are live — try the controls.
      </div>

      <Frame title="Header bar · scoped & all-PRs">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MiniHeader scope={['site-vdp-remix#835']} />
          <MiniHeader scope={[]} />
        </div>
      </Frame>

      <Frame title="Status pills">
        <div style={swatchBox}>
          <ReviewPill review="APPROVED" />
          <ReviewPill review="REVIEW_REQUIRED" />
          <ReviewPill review="DRAFT" />
          <StatusPill pill={{ label: '3 auto-fixable', kind: 'auto' }} />
          <StatusPill pill={{ label: 'behind base', kind: 'behind' }} />
          <StatusPill pill={{ label: 'CI failing: unit-api', kind: 'ci' }} />
        </div>
      </Frame>

      <Frame title="Thread disposition tags">
        <div style={swatchBox}>
          {Object.values(tagMeta).map((m) => (
            <DispositionTag key={m.label} tone={m.tone}>{m.label}</DispositionTag>
          ))}
        </div>
      </Frame>

      <Frame title="PR card · needs you (emphasis)" caption="Accent rule + seal mark set urgent cards apart.">
        <PRCard pr={EX_NEEDS} needsYou dash={dash} />
      </Frame>

      <Frame title="PR card · calm" caption="Auto-handled and informational cards stay quiet.">
        <PRCard pr={EX_CALM} needsYou={false} dash={dash} />
      </Frame>

      <Frame title="PR card · dense (many threads)" caption="Long comment bodies scroll within each thread.">
        <PRCard pr={EX_DENSE} needsYou={false} dash={dash} />
      </Frame>

      <Frame title="PR card · no threads">
        <PRCard pr={EX_NONE} needsYou={false} dash={dash} />
      </Frame>

      <Frame title="Thread rows · all dispositions" caption="Each tag with its own action controls.">
        <PRCard pr={GALLERY_ALL} needsYou={false} dash={dash} />
      </Frame>

      <Frame title="After you act · confirmations" caption="Approved, skipped and rebutted threads.">
        <PRCard pr={GALLERY_TAKEN} needsYou={false} dash={dash} />
      </Frame>

      <Frame title="JIRA-needed banner" caption="Pending (top) and linked (bottom).">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <PRCard pr={GALLERY_JIRA} needsYou={false} dash={dash} />
          <PRCard pr={GALLERY_JIRA_SET} needsYou={false} dash={dash} />
        </div>
      </Frame>

      <Frame title="Empty section">
        <EmptyState label="Nothing flagged." />
      </Frame>

      <Frame title="Loading · first fetch">
        <Skeleton />
      </Frame>

      <Toast message={dash.toastMsg} />
    </div>
  );
}
