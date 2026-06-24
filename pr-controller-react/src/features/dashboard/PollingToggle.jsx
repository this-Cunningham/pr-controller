import { Toggle } from '../../design-system/core/Toggle.jsx';
import { OrganicLoader } from '../../design-system/feedback/OrganicLoader.jsx';
import styles from './PollingToggle.module.css';

/**
 * The header arm switch — the design-system <Toggle> plus polling-specific status:
 *   - on        → daemon is watching / may be dispatching (Toggle on + breathing dot)
 *   - winding   → switched off but workers are still finishing (Toggle off + stones loader)
 *   - off       → idle/resting (Toggle off, no indicator)
 * Composes the frozen DS Toggle for the switch itself; the indicator + secondary label are
 * the feature-specific surround. Pure renderer — the daemon owns the truth; this calls onToggle.
 */
export default function PollingToggle({ on, winding, workingCount = 0, onToggle }) {
  const state = on ? 'on' : winding ? 'winding' : 'off';
  const secondary =
    state === 'on' ? 'Watching your PRs'
    : state === 'winding' ? `finishing ${workingCount} ${workingCount === 1 ? 'task' : 'tasks'}`
    : 'Paused · resting';

  return (
    <div className={styles.wrap}>
      <span className={styles.row}>
        <span className={styles.indicator}>
          {state === 'on' && <span className={styles.dot} />}
          {state === 'winding' && <OrganicLoader variant="stones" size={30} />}
        </span>
        <Toggle checked={on} disabled={winding} onChange={() => onToggle()} ariaLabel={`Actively working — ${on ? 'on' : 'off'}`} />
      </span>
      <span className={styles.secondary} data-state={state}>{secondary}</span>
    </div>
  );
}
