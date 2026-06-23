import { ScopeBadge } from '../../design-system/navigation/ScopeBadge.jsx';
import { ThemeSwitcher } from '../../design-system/core/ThemeSwitcher.jsx';
import { Button } from '../../design-system/core/Button.jsx';
import styles from './Header.module.css';

const THEME_KEY = 'pr-controller-theme';

export default function Header({ dash }) {
  const { scope, explainScope, refresh, refreshing, updated, openCount, needCount, runPoll, lastPollError } = dash;
  const scoped = (scope || []).length > 0;

  return (
    <header className={styles.header}>
      <div className={styles.main}>
        <div className={styles.titleRow}>
          <h1 className={styles.wordmark}>PR Controller</h1>
          <ScopeBadge scope={scoped ? 'scoped' : 'all'} count={(scope || []).length} onToggle={explainScope} />
        </div>
        <div className={styles.stats}>
          {openCount} open&nbsp;&nbsp;·&nbsp;&nbsp;
          <span className={styles.statNeed}>{needCount} need you</span>
          &nbsp;&nbsp;·&nbsp;&nbsp;updated {updated}
          {lastPollError && (
            <>
              &nbsp;&nbsp;·&nbsp;&nbsp;
              <span className={styles.scanError} title={lastPollError.message || 'scan failed'}>⚠ scan failing</span>
            </>
          )}
        </div>
      </div>

      <div className={styles.controls}>
        {/* 6-theme picker; persists the choice so a reload keeps it. ThemeSwitcher
            writes <html data-theme>, which retints every token. */}
        <ThemeSwitcher onChange={(t) => { try { localStorage.setItem(THEME_KEY, t); } catch {} }} />

        {/* TEMP (debug): trigger a backend poll instead of waiting for the poll timer. */}
        <Button variant="ghost" onClick={runPoll}>Run poll</Button>

        <Button variant="outline" onClick={refresh}>
          <span className={`${styles.refreshIcon}${refreshing ? ' ws-spin' : ''}`}>⟳</span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>
    </header>
  );
}
