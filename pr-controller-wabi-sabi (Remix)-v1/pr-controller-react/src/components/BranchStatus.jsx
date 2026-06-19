import Button from './Button.jsx';

const mono = "'IBM Plex Mono', monospace";

function TerminalNote({ children = 'Terminal session opened…' }) {
  return (
    <span style={{ fontSize: 12.5, color: 'var(--ink-2)', display: 'inline-flex', gap: 6, alignItems: 'center', animation: 'appear .3s ease' }}>
      <span style={{ fontFamily: mono, color: 'var(--accent)' }}>›_</span>
      {children}
    </span>
  );
}

const surfaced = { background: 'var(--accent-soft)', border: '1px solid var(--accent-bg)', borderRadius: 6, padding: '12px 14px' };
const lead = { display: 'flex', gap: 9, alignItems: 'flex-start' };
const mark = { color: 'var(--accent)', fontSize: 12, lineHeight: 1.5 };
const line = { fontSize: 13, lineHeight: 1.5, color: 'var(--ink)' };
const ctaRow = { marginTop: 11, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' };

// PR-level branch health, separate from per-thread actions. There is no
// manual rebase button — rebasing is part of the agent's single run.
//   conflict  → informational + pulsing (In progress)
//   surfaced  → Show details + Open in terminal (Needs you)
//   outofsync → Resolve in terminal (Needs you)
export default function BranchStatus({ pr, dash }) {
  const b = pr.branch;
  if (b.kind === 'conflict') {
    return (
      <div
        style={{
          marginTop: 13,
          display: 'flex',
          gap: 9,
          alignItems: 'flex-start',
          padding: '11px 13px',
          borderRadius: 6,
          background: 'var(--auto-bg)',
          color: 'var(--auto-fg)',
          fontSize: 12.5,
          lineHeight: 1.5,
        }}
      >
        <span style={{ flex: 'none', marginTop: 5, width: 7, height: 7, borderRadius: '50%', background: 'currentColor', animation: 'pulse 1.8s ease-in-out infinite' }} />
        <span>Resolving merge conflict — the agent is rebasing this; if it can’t resolve safely it’ll surface it for you.</span>
      </div>
    );
  }
  if (b.kind === 'surfaced') {
    const open = dash.branchDetailsOpen(pr.id);
    return (
      <div style={{ marginTop: 13, ...surfaced }}>
        <div style={lead}>
          <span style={mark}>◆</span>
          <div style={line}>{b.detail || 'Rebase too risky to do automatically — open a terminal to continue.'}</div>
        </div>
        {b.details && (
          <>
            <div style={{ marginTop: 9 }}>
              <a onClick={() => dash.toggleBranchDetails(pr.id)} style={{ fontSize: 12.5, color: 'var(--ink-2)', cursor: 'pointer' }}>
                ↳ {open ? 'Hide details' : 'Show details'}
              </a>
            </div>
            {open && (
              <div style={{ marginTop: 7, fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-2)', background: 'var(--surface-2)', borderRadius: 5, padding: '9px 11px' }}>{b.details}</div>
            )}
          </>
        )}
        <div style={ctaRow}>
          <Button variant="primary" onClick={() => dash.branchTerminal(pr.id)}>Open in terminal</Button>
          {dash.branchTerminalOpen(pr.id) && <TerminalNote />}
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 13, ...surfaced }}>
      <div style={lead}>
        <span style={mark}>◆</span>
        <div style={line}>{b.detail || 'Branch has diverged from remote — the agent hasn’t run on it.'}</div>
      </div>
      <div style={ctaRow}>
        <Button variant="primary" onClick={() => dash.branchTerminal(pr.id)}>Resolve in terminal</Button>
        {dash.branchTerminalOpen(pr.id) && <TerminalNote />}
      </div>
    </div>
  );
}
