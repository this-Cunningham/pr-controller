import { pillMeta } from '../meta.js';

export default function StatusPill({ pill }) {
  const m = pillMeta[pill.kind] || pillMeta.behind;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11.5,
        padding: '3px 9px',
        borderRadius: 4,
        background: m.bg,
        color: m.fg,
      }}
    >
      {m.dot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'currentColor',
            display: 'inline-block',
          }}
        />
      )}
      {pill.label}
    </span>
  );
}
