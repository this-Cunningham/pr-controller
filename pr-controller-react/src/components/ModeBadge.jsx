export default function ModeBadge({ mode, onToggle }) {
  const live = mode === 'live';
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
    >
      {live ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 12px',
            borderRadius: 20,
            background: 'var(--accent-bg)',
            color: 'var(--accent)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent)',
              animation: 'pulse 1.6s ease-in-out infinite',
            }}
          />
          Live
        </span>
      ) : (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 12px',
            borderRadius: 20,
            background: 'var(--surface-2)',
            color: 'var(--ink-2)',
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{ width: 9, height: 9, borderRadius: '50%', border: '1.5px solid var(--ink-3)' }}
          />
          Safe — no actions taken
        </span>
      )}
    </button>
  );
}
