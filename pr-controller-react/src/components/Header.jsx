import { ScopeBadge } from '../design-system/components/navigation/ScopeBadge.jsx';
import { ThemeSwitcher } from '../design-system/components/core/ThemeSwitcher.jsx';
import { Button } from '../design-system/components/core/Button.jsx';

const mono = 'var(--font-mono)';
const THEME_KEY = 'pr-controller-theme';

export default function Header({ dash }) {
  const { scope, explainScope, refresh, refreshing, updated, openCount, needCount, runPoll } = dash;
  const scoped = (scope || []).length > 0;

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
          <ScopeBadge scope={scoped ? 'scoped' : 'all'} count={(scope || []).length} onToggle={explainScope} />
        </div>
        <div style={{ marginTop: 11, fontSize: 13, color: 'var(--ink-2)', fontFamily: mono }}>
          {openCount} open&nbsp;&nbsp;·&nbsp;&nbsp;
          <span style={{ color: 'var(--accent)' }}>{needCount} need you</span>
          &nbsp;&nbsp;·&nbsp;&nbsp;updated {updated}
        </div>
      </div>

      <div style={{ flex: 'none', display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* 6-theme picker; persists the choice so a reload keeps it. ThemeSwitcher
            writes <html data-theme>, which retints every token. */}
        <ThemeSwitcher onChange={(t) => { try { localStorage.setItem(THEME_KEY, t); } catch {} }} />

        {/* TEMP (debug): trigger a backend poll instead of waiting the 30-min timer. */}
        <Button variant="ghost" onClick={runPoll}>Run poll</Button>

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
