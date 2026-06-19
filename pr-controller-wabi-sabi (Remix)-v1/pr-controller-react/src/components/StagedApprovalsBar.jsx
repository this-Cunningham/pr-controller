import Button from './Button.jsx';

const mono = "'IBM Plex Mono', monospace";

// Per-PR cart footer: fire ONE agent run that carries out every approach
// staged on this PR. Shown in the Needs-you card when count > 0.
export default function StagedApprovalsBar({ count, running, onRun }) {
  return (
    <div
      style={{
        marginTop: 14,
        borderTop: '1px solid var(--line)',
        paddingTop: 13,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      {running ? (
        <span style={{ fontSize: 12.5, color: 'var(--ink-2)', display: 'inline-flex', gap: 7, alignItems: 'center', animation: 'appear .3s ease' }}>
          <span style={{ fontFamily: mono, color: 'var(--accent)' }}>›_</span>
          Agent run started — {count} staged item{count === 1 ? '' : 's'} queued.
        </span>
      ) : (
        <>
          <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
            {count} approach{count === 1 ? '' : 'es'} staged for this PR
          </span>
          <Button variant="accent" onClick={onRun}>
            Run agent ({count})
          </Button>
        </>
      )}
    </div>
  );
}
