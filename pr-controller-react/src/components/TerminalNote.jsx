// App composition: the ›_ terminal hand-off note that slides into a PR card /
// thread when an interactive terminal session is opened. The design system has
// this pattern as an inline helper in its reference ThreadRow but does NOT
// export it, so it lives here as an app component (flagged in the PR).
const mono = 'var(--font-mono)';

export default function TerminalNote({ children }) {
  return (
    <div style={{ marginTop: 11, fontSize: 12.5, color: 'var(--ink-2)', display: 'flex', gap: 7, alignItems: 'center', animation: 'ws-appear .3s ease' }}>
      <span style={{ fontFamily: mono, color: 'var(--accent)' }}>›_</span>
      {children}
    </div>
  );
}
