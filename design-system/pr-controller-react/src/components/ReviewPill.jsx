import { reviewMeta } from '../meta.js';

export default function ReviewPill({ review }) {
  const m = reviewMeta[review] || reviewMeta.REVIEW_REQUIRED;
  return (
    <span
      style={{
        flex: 'none',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11,
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        padding: '4px 9px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
        background: m.bg,
        color: m.fg,
        border: `1px solid ${m.bd}`,
      }}
    >
      {m.label}
    </span>
  );
}
