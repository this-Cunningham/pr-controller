import { ScopeBadge } from '../../design-system/navigation/ScopeBadge.jsx';
import { ThemeSwitcher } from '../../design-system/core/ThemeSwitcher.jsx';
import { Button } from '../../design-system/core/Button.jsx';
import PollingToggle from './PollingToggle.jsx';
import styles from './Header.module.css';

const THEME_KEY = 'pr-controller-theme';

export default function Header({ dash }) {
  const { scope, explainScope, refresh, refreshing, updated, openCount, needCount, lastPollError,
    pollingEnabled, togglePolling, workingCount, openSettings } = dash;
  const scoped = (scope || []).length > 0;
  // "Winding down": switched off but workers are still finishing (the let-in-flight-finish state).
  const winding = !pollingEnabled && workingCount > 0;

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
        {/* Arm switch (server-authoritative): the daemon doesn't scan or dispatch until this
            is on, and it's off again after every restart. togglePolling POSTs /polling;
            pollingEnabled comes back from state.json. Switching off lets in-flight workers
            finish (the "winding down" state). */}
        <PollingToggle on={pollingEnabled} winding={winding} workingCount={workingCount} onToggle={togglePolling} />

        {/* 6-theme picker; persists the choice so a reload keeps it. ThemeSwitcher
            writes <html data-theme>, which retints every token. */}
        <ThemeSwitcher onChange={(t) => { try { localStorage.setItem(THEME_KEY, t); } catch {} }} />

        <Button variant="outline" onClick={refresh}>
          <span className={`${styles.refreshIcon}${refreshing ? ' ws-spin' : ''}`}>⟳</span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>

        {/* Settings overlay (scope / cadence / model / worker sensitivity). */}
        <button type="button" className={styles.gear} onClick={openSettings} aria-label="Settings" title="Settings">⚙</button>
      </div>
    </header>
  );
}
