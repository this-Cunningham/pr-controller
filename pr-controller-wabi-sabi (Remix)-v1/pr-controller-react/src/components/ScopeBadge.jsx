// Header scope badge. NOT a safe/live switch — the agent always acts for
// real on the PRs it can see; this only shows WHICH PRs it watches.
//   'all'    → calm, sage dot, "Watching all PRs"
//   'scoped' → accent, hollow ring, "Scoped · N PRs"
export default function ScopeBadge({ scope, count = 0, onToggle }) {
  const scoped = scope === 'scoped';
  return (
    <button
      type="button"
      onClick={onToggle}
      title="The agent always acts for real — this only changes which PRs it watches."
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
    >
      {scoped ? (
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
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid var(--accent)' }} />
          Scoped · {count} PRs
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
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--auto-fg)' }} />
          Watching all PRs
        </span>
      )}
    </button>
  );
}
