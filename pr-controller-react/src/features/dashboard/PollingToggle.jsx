import { OrganicLoader } from '../../design-system/feedback/OrganicLoader.jsx';
import styles from './PollingToggle.module.css';

/**
 * The header arm switch — a sliding toggle with three states, server-authoritative:
 *   - on        → daemon is watching + may be dispatching (sage track, breathing dot)
 *   - winding   → switched off but workers are still finishing (off track + stones loader)
 *   - off       → idle/resting (off track, no indicator)
 * Pure renderer: it shows `on`/`winding` and calls `onToggle`; the daemon owns the truth.
 * No new design-system primitive — composed from tokens + the DS OrganicLoader.
 */
export default function PollingToggle({ on, winding, workingCount = 0, onToggle }) {
  const state = on ? 'on' : winding ? 'winding' : 'off';
  const secondary =
    state === 'on' ? 'Watching your PRs'
    : state === 'winding' ? `finishing ${workingCount} ${workingCount === 1 ? 'task' : 'tasks'}`
    : 'Paused · resting';

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={onToggle}
      aria-label={`Actively working — ${on ? 'on' : 'off'}`}
      aria-pressed={on}
      title="Turns the agent on or off. It opens off every session; switching off lets any in-flight task finish."
    >
      <span className={styles.row}>
        <span className={styles.indicator}>
          {state === 'on' && <span className={styles.dot} />}
          {state === 'winding' && <OrganicLoader variant="stones" size={30} />}
        </span>
        <span className={styles.track} data-state={state}>
          <span className={styles.knob} data-state={state} />
        </span>
      </span>
      <span className={styles.secondary} data-state={state}>{secondary}</span>
    </button>
  );
}
