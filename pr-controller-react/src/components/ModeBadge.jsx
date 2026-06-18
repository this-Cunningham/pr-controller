// Scope badge. The worker is always live (it acts on whatever it can see); the
// badge communicates the blast radius set by config.onlyPRs:
//   []          -> live on ALL your open PRs (full production)
//   ['a#1', …]  -> scoped to those PR keys; everything else is untouched
export default function ScopeBadge({ scope = [], onExplain }) {
  const scoped = scope.length > 0;
  const label = scoped ? `Scoped · ${scope.length} PR${scope.length > 1 ? 's' : ''}` : 'Live · all PRs';
  return (
    <button
      type="button"
      onClick={onExplain}
      title={scoped ? scope.join(', ') : 'Acting on every open PR'}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '5px 12px',
          borderRadius: 20,
          background: scoped ? 'var(--surface-2)' : 'var(--accent-bg)',
          color: scoped ? 'var(--ink-2)' : 'var(--accent)',
          fontSize: 12,
          fontWeight: scoped ? 500 : 600,
          whiteSpace: 'nowrap',
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
        {label}
      </span>
    </button>
  );
}
