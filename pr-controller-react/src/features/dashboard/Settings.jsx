import { useEffect } from 'react';
import { ThemeSwitcher } from '../../design-system/core/ThemeSwitcher.jsx';
import SettingsSetup from './SettingsSetup.jsx';
import WorkerSensitivity from './WorkerSensitivity.jsx';
import styles from './Settings.module.css';

const THEME_KEY = 'pr-controller-theme';

/**
 * Settings overlay — opened by the header gear. Mirrors the settings overlay in the
 * PR Controller prototype: a scrim-backed stack of standalone cards (no tabs) — a Default
 * view card, a Theme preference card, then the Worker Sensitivity panel, then the Agent
 * Setup panel. Each embedded panel is its own bordered card and POSTs its own save via
 * `saveConfig` (server-authoritative state.json `settings`). This shell owns only theme
 * persistence and dismissal. Closes on backdrop click / Escape / Close.
 *
 * (The "Default view" card — Dashboard | Swimlanes — is kept to match the prototype but is
 * INERT dead UI: the app has no swimlane view to switch to, so the toggle has no onClick.
 * Wire it to a real view mode here if/when swimlanes ship — see the inline note below.)
 */
export default function Settings({ settings, sensitivityLevels, saveConfig, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <span className={styles.headEyebrow}>Settings</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close settings">
            Close <span className={styles.kbd}>esc</span>
          </button>
        </div>

        {!settings ? (
          <div className={styles.loading}>Loading settings…</div>
        ) : (
          <>
            {/* Default view — DEAD UI. The app has no swimlane view to switch to, so this
                toggle is inert (no onClick); kept to match the PR Controller prototype.
                Wire it to a real view mode here if/when swimlanes ship. */}
            <section className={styles.prefCard}>
              <div className={styles.prefText}>
                <span className={styles.prefEyebrow}>Default view</span>
                <span className={styles.prefDesc}>Show your PRs as a list or a swimlane board.</span>
              </div>
              <div className={styles.seg} role="group" aria-label="Default view">
                <button type="button" className={styles.segItem} data-active="true">Dashboard</button>
                <button type="button" className={styles.segItem}>Swimlanes</button>
              </div>
            </section>

            {/* Theme — the prototype carries this preference in the shell, not the panels */}
            <section className={styles.prefCard}>
              <div className={styles.prefText}>
                <span className={styles.prefEyebrow}>Theme</span>
                <span className={styles.prefDesc}>Switch the paper-and-ink palette.</span>
              </div>
              <ThemeSwitcher
                onChange={(t) => { try { localStorage.setItem(THEME_KEY, t); } catch { /* ignore */ } }}
              />
            </section>

            <WorkerSensitivity sensitivityLevels={sensitivityLevels} settings={settings} saveConfig={saveConfig} />
            <SettingsSetup settings={settings} saveConfig={saveConfig} />
          </>
        )}
      </div>
    </div>
  );
}
