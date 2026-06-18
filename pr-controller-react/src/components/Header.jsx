import ScopeBadge from './ModeBadge.jsx';

const mono = "'IBM Plex Mono', monospace";

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
              fontFamily: "'Newsreader', Georgia, serif",
              fontWeight: 500,
              fontSize: 28,
              letterSpacing: '-.01em',
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
        {/* TEMP (debug): trigger a backend poll instead of waiting the 30-min timer. */}
        <button
          type="button"
          onClick={runPoll}
          title="Run a poll now (debug)"
          style={{
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            font: "500 13px 'Hanken Grotesk', sans-serif",
            padding: '9px 15px',
            border: '1px dashed var(--line-2)',
            borderRadius: 7,
            background: 'var(--surface)',
            color: 'var(--ink-2)',
          }}
        >
          ▶ Run poll
        </button>

        <button
          type="button"
          className="refresh"
          onClick={refresh}
          style={{
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            font: "500 13px 'Hanken Grotesk', sans-serif",
            padding: '9px 15px',
            border: '1px solid var(--line-2)',
            borderRadius: 7,
            background: 'var(--surface)',
            color: 'var(--ink)',
          }}
        >
          <span
            style={{
              fontSize: 15,
              display: 'inline-block',
              animation: refreshing ? 'spin .9s linear infinite' : 'none',
            }}
          >
            ⟳
          </span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </header>
  );
}
