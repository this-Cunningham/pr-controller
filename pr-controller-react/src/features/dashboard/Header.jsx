import { ScopeBadge } from '../../design-system/navigation/ScopeBadge.jsx';
import PollingToggle from './PollingToggle.jsx';
import styles from './Header.module.css';

/**
 * Dashboard header — matches the Header prototype: one row, wordmark · scope · | · updated
 * on the left, the polling toggle · | · settings gear on the right. The per-lane counts live
 * on the Tabs; theme selection moved into Settings; auto-refresh (SSE + poll) replaces the old
 * manual Refresh button. The scan-failing state folds into the "updated" line.
 */
export default function Header({ dash }) {
  const { scope, explainScope, updated, lastPollError, pollingEnabled, togglePolling, workingCount, openSettings } = dash;
  const scoped = (scope || []).length > 0;
  // "Winding down": switched off but workers are still finishing (the let-in-flight-finish state).
  const winding = !pollingEnabled && workingCount > 0;

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.wordmark}>PR Controller</h1>
        <ScopeBadge scope={scoped ? 'scoped' : 'all'} count={(scope || []).length} onToggle={explainScope} />
        <span className={styles.divider} aria-hidden="true" />
        <span className={styles.updated}>
          updated {updated}
          {lastPollError && (
            <span className={styles.scanError} title={lastPollError.message || 'scan failed'}> · ⚠ scan failing</span>
          )}
        </span>
      </div>

      <div className={styles.right}>
        <PollingToggle on={pollingEnabled} winding={winding} workingCount={workingCount} onToggle={togglePolling} />
        <span className={styles.divider} aria-hidden="true" />
        <button type="button" className={styles.gear} onClick={openSettings} aria-label="Settings" title="Settings">⚙</button>
      </div>
    </header>
  );
}
