import ScopeBadge from './ModeBadge.jsx';
import Button from './Button.jsx';

const mono = 'var(--font-mono)';

export default function Header({ dash }) {
  const { scope, explainScope, refresh, refreshing, updated, openCount, needCount, runPoll } = dash;
  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 20,
        paddingBottom: 22,
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif)',
              fontWeight: 500,
              fontSize: 'var(--text-wordmark)',
              letterSpacing: 'var(--tracking-tight)',
              color: 'var(--ink)',
              whiteSpace: 'nowrap',
            }}
          >
            PR Controller
          </h1>
          <ScopeBadge scope={scope} onExplain={explainScope} />
        </div>
        <div style={{ marginTop: 11, fontSize: 13, color: 'var(--ink-2)', fontFamily: mono }}>
          {openCount} open&nbsp;&nbsp;·&nbsp;&nbsp;
          <span style={{ color: 'var(--accent)' }}>{needCount} need you</span>
          &nbsp;&nbsp;·&nbsp;&nbsp;updated {updated}
        </div>
      </div>

      <div style={{ flex: 'none', display: 'flex', gap: 8 }}>
        {/* TEMP (debug): trigger a backend poll instead of waiting the 30-min timer.
            Low-stakes utility -> ghost; the dashed-border debug treatment was dropped
            because the design system has no such variant. */}
        <Button variant="ghost" onClick={runPoll}>
          Run poll
        </Button>

        <Button variant="outline" onClick={refresh}>
          <span
            style={{
              fontSize: 15,
              display: 'inline-block',
              marginRight: 8,
              animation: refreshing ? 'ws-spin .9s linear infinite' : 'none',
            }}
          >
            ⟳
          </span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>
    </header>
  );
}
