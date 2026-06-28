import { useEffect, useState } from 'react';
import { ThemeSwitcher } from '../../design-system/core/ThemeSwitcher.jsx';
import SettingsSetup from './SettingsSetup.jsx';
import WorkerSensitivity from './WorkerSensitivity.jsx';
import PromptTracer from './PromptTracer.jsx';
import styles from './Settings.module.css';

const THEME_KEY = 'pr-controller-theme';

// Settings-modal tabs — order + default ('agent') mirror PR Controller.dc.html's settings modal.
const TABS = [
  { key: 'agent', label: 'Agent setup' },
  { key: 'sensitivity', label: 'Worker sensitivity' },
  { key: 'prompt', label: 'Prompt tracer' },
  { key: 'appearance', label: 'Appearance' },
];

/**
 * Settings overlay — opened by the header gear. Mirrors the settings overlay in the
 * PR Controller prototype: a scrim-backed modal whose body is a four-tab control —
 * 'Agent setup' (default), 'Worker sensitivity', 'Prompt tracer' (a read-only explainer
 * of the net worker prompt), and 'Appearance' (default view + theme).
 * Each embedded panel is its own bordered card and POSTs its own save via `saveConfig`
 * (server-authoritative state.json `settings`). This shell owns only theme persistence,
 * the active tab, and dismissal. Closes on backdrop click / Escape / Close.
 *
 * The Appearance tab's "Default view" card switches between the dashboard list and the
 * swimlane board (`viewMode` / `onSetViewMode`, persisted in useDashboard).
 */
export default function Settings({ settings, sensitivityLevels, saveConfig, onClose, viewMode, onSetViewMode }) {
  const [tab, setTab] = useState('agent');

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
            <div className={styles.tabs} role="tablist" aria-label="Settings sections">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  className={styles.tab}
                  data-active={tab === t.key}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'agent' && <SettingsSetup settings={settings} saveConfig={saveConfig} />}

            {tab === 'sensitivity' && (
              <WorkerSensitivity sensitivityLevels={sensitivityLevels} settings={settings} saveConfig={saveConfig} />
            )}

            {tab === 'prompt' && <PromptTracer />}

            {tab === 'appearance' && (
              <div className={styles.panel}>
                {/* Default view — switches the dashboard list vs the swimlane board
                    (useDashboard.viewMode, persisted to localStorage). */}
                <section className={styles.prefCard}>
                  <div className={styles.prefText}>
                    <span className={styles.prefEyebrow}>Default view</span>
                    <span className={styles.prefDesc}>Show your PRs as a list or a swimlane board.</span>
                  </div>
                  <div className={styles.seg} role="group" aria-label="Default view">
                    <button
                      type="button"
                      className={styles.segItem}
                      data-active={viewMode !== 'swimlanes'}
                      onClick={() => onSetViewMode('dashboard')}
                    >
                      Dashboard
                    </button>
                    <button
                      type="button"
                      className={styles.segItem}
                      data-active={viewMode === 'swimlanes'}
                      onClick={() => onSetViewMode('swimlanes')}
                    >
                      Swimlanes
                    </button>
                  </div>
                </section>

                {/* Theme — the prototype carries this preference in the shell, not the panels */}
                <section className={styles.prefCard}>
                  <div className={styles.prefText}>
                    <span className={styles.prefEyebrow}>Theme</span>
                    <span className={styles.prefDesc}>Switch the paper-and-ink palette.</span>
                  </div>
                  <ThemeSwitcher
                    onChange={(next) => { try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ } }}
                  />
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
