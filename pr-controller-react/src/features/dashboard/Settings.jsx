import { useEffect, useState } from 'react';
import { Tabs } from '../../design-system/navigation/Tabs.jsx';
import SettingsSetup from './SettingsSetup.jsx';
import WorkerSensitivity from './WorkerSensitivity.jsx';
import styles from './Settings.module.css';

/**
 * Settings overlay — opened by the header gear. A modal shell with two tabs (Setup +
 * Worker sensitivity); each tab is a self-contained editor that POSTs its own save via
 * `saveConfig`. The config it edits is server-authoritative (state.json `settings`); this
 * component owns only the open tab + dismissal. Closes on backdrop click / Escape / ×.
 */
export default function Settings({ settings, sensitivityLevels, saveConfig, onClose }) {
  const [tab, setTab] = useState('setup');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <Tabs
            sticky={false}
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'setup', label: 'Setup' },
              { key: 'sensitivity', label: 'Worker sensitivity' },
            ]}
          />
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close settings" title="Close">×</button>
        </div>
        <div className={styles.body}>
          {!settings ? (
            <div className={styles.loading}>Loading settings…</div>
          ) : tab === 'setup' ? (
            <SettingsSetup settings={settings} saveConfig={saveConfig} />
          ) : (
            <WorkerSensitivity sensitivityLevels={sensitivityLevels} settings={settings} saveConfig={saveConfig} />
          )}
        </div>
      </div>
    </div>
  );
}
