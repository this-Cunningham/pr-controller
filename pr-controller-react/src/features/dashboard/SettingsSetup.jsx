import { useState } from 'react';
import { Button } from '../../design-system/core/Button.jsx';
import { Confirmation } from '../../design-system/feedback/Confirmation.jsx';
import styles from './SettingsSetup.module.css';

/**
 * Agent setup (Settings). Renders the daemon's server-authoritative `settings` and edits
 * only the three writable fields (onlyPRs, pollMinutes, workerModel) via a local working
 * copy, POSTing them through saveConfig on save. Everything else — connection, trigger
 * phrases, check rules — is display-only (the daemon owns that truth; the panel never
 * derives config of its own). All styling is in the .module.css (tokens via var()); state
 * rides on data-attrs, not inline styles.
 */

const POLL_MIN = 5;
const POLL_MAX = 60;
const POLL_STEP = 5;

// Segmented control: label ⇄ workerModel value ⇄ model id (display only).
const MODELS = [
  { value: 'haiku', label: 'Fast', id: 'claude-haiku-4-5' },
  { value: 'sonnet', label: 'Balanced', id: 'claude-sonnet-4-6' },
  { value: 'opus', label: 'Deep', id: 'claude-opus-4-8' },
];

// "repo#123" | "owner/repo#123" | github.com/owner/repo/pull/123 → normalized "repo#123".
function normalizePR(raw) {
  const s = (raw || '').trim();
  if (!s) return null;
  const url = s.match(/github\.com\/[^/]+\/([^/]+)\/pull\/(\d+)/i);
  if (url) return `${url[1]}#${url[2]}`;
  const owned = s.match(/^[^/\s#]+\/([^/\s#]+)#(\d+)$/);
  if (owned) return `${owned[1]}#${owned[2]}`;
  const plain = s.match(/^([^/\s#]+)#(\d+)$/);
  if (plain) return `${plain[1]}#${plain[2]}`;
  return null;
}

function pollHint(mins) {
  const word =
    mins <= POLL_MIN ? 'as fast as it goes'
    : mins >= POLL_MAX ? 'lightest touch'
    : mins >= 30 ? 'relaxed'
    : 'responsive';
  return `range ${POLL_MIN}–${POLL_MAX} · ${word}`;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

export default function SettingsSetup({ settings, saveConfig }) {
  const s = settings || {};
  const savedPRs = s.onlyPRs || [];
  const savedPoll = typeof s.pollMinutes === 'number' ? s.pollMinutes : POLL_MIN;
  const savedModel = s.workerModel || 'sonnet';

  const [onlyPRs, setOnlyPRs] = useState(savedPRs);
  const [pollMinutes, setPollMinutes] = useState(savedPoll);
  const [workerModel, setWorkerModel] = useState(savedModel);
  const [draft, setDraft] = useState('');
  const [prError, setPrError] = useState('');
  const [saved, setSaved] = useState(false);

  const dirty =
    !arraysEqual(onlyPRs, savedPRs) ||
    pollMinutes !== savedPoll ||
    workerModel !== savedModel;

  const handle = s.account || s.login || 'unknown';
  const avatar = (s.account || s.login || '—').slice(0, 2).toUpperCase();
  const activeModel = MODELS.find((m) => m.value === workerModel) || MODELS[1];

  function touched() { if (saved) setSaved(false); }

  function addPR() {
    const norm = normalizePR(draft);
    if (!norm) {
      setPrError('Use repo#NN, owner/repo#NN, or a GitHub PR URL.');
      return;
    }
    if (onlyPRs.some((p) => p.toLowerCase() === norm.toLowerCase())) {
      setPrError('Already watching that PR.');
      return;
    }
    setOnlyPRs([...onlyPRs, norm]);
    setDraft('');
    setPrError('');
    touched();
  }

  function removePR(key) {
    setOnlyPRs(onlyPRs.filter((p) => p !== key));
    touched();
  }

  function setPoll(next) {
    const clamped = Math.max(POLL_MIN, Math.min(POLL_MAX, next));
    setPollMinutes(clamped);
    touched();
  }

  function pickModel(value) {
    setWorkerModel(value);
    touched();
  }

  function revert() {
    setOnlyPRs(savedPRs);
    setPollMinutes(savedPoll);
    setWorkerModel(savedModel);
    setDraft('');
    setPrError('');
    setSaved(false);
  }

  async function save() {
    await saveConfig({ onlyPRs, pollMinutes, workerModel });
    setSaved(true);
  }

  return (
    <div className={styles.panel}>
      {/* HEADER */}
      <header className={styles.headingText}>
        <span className={styles.eyebrow}>Agent setup</span>
        <h2 className={styles.title}>Where the agent watches, and how it runs.</h2>
        <p className={styles.desc}>
          Point the agent at the PRs it may act on, and tune how often it checks and which
          model it runs.
        </p>
      </header>

      {/* CONNECTION (read-only) */}
      <section className={styles.connection}>
        <div className={styles.connLeft}>
          <span className={styles.avatar}>{avatar}</span>
          <div className={styles.connText}>
            <span className={styles.connLine}>
              <span className={styles.breathDot} aria-hidden="true" />
              Connected to GitHub
            </span>
            <span className={styles.connHandle}>signed in as @{handle}</span>
          </div>
        </div>
        <span className={styles.connNote}>The agent skips your own comments.</span>
      </section>

      {/* WHICH PRs TO WATCH (editable → onlyPRs) */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>Which PRs to watch</span>
          <span className={styles.count}>{onlyPRs.length} {onlyPRs.length === 1 ? 'PR' : 'PRs'}</span>
        </div>
        <p className={styles.sectionDesc}>
          The PRs the agent is allowed to act on. Empty = it watches all your open PRs.
        </p>

        {onlyPRs.length === 0 ? (
          <p className={styles.emptyPRs}>
            Watching all your open PRs — add a PR below to scope it.
          </p>
        ) : (
          <ul className={styles.prList}>
            {onlyPRs.map((key) => (
              <li key={key} className={styles.prRow}>
                <span className={styles.prMark} aria-hidden="true">◆</span>
                <span className={styles.prKey}>{key}</span>
                <button
                  type="button"
                  className={styles.prRemove}
                  onClick={() => removePR(key)}
                  aria-label={`Stop watching ${key}`}
                >×</button>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.prAdd}>
          <input
            className={styles.input}
            type="text"
            value={draft}
            placeholder="repo#NN, owner/repo#NN, or a PR URL"
            onChange={(e) => { setDraft(e.target.value); if (prError) setPrError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPR(); } }}
            aria-label="Add a PR to watch"
          />
          <Button variant="outline" onClick={addPR}>Add</Button>
        </div>
        {prError && <p className={styles.fieldError}>{prError}</p>}
      </section>

      {/* CADENCE + MODEL */}
      <section className={styles.grid2}>
        {/* How often to check (editable → pollMinutes) */}
        <div className={styles.field}>
          <span className={styles.eyebrow}>How often to check</span>
          <div className={styles.stepper}>
            <button
              type="button"
              className={styles.stepBtn}
              onClick={() => setPoll(pollMinutes - POLL_STEP)}
              disabled={pollMinutes <= POLL_MIN}
              aria-label="Check less often"
            >−</button>
            <span className={styles.stepReadout}>{pollMinutes} min</span>
            <button
              type="button"
              className={styles.stepBtn}
              onClick={() => setPoll(pollMinutes + POLL_STEP)}
              disabled={pollMinutes >= POLL_MAX}
              aria-label="Check more often"
            >+</button>
          </div>
          <span className={styles.hint}>{pollHint(pollMinutes)}</span>
        </div>

        {/* Assistant model (editable → workerModel) */}
        <div className={styles.field}>
          <span className={styles.eyebrow}>Assistant model</span>
          <div className={styles.segmented} role="radiogroup" aria-label="Assistant model">
            {MODELS.map((m) => (
              <button
                key={m.value}
                type="button"
                className={styles.segment}
                data-active={workerModel === m.value || undefined}
                role="radio"
                aria-checked={workerModel === m.value}
                onClick={() => pickModel(m.value)}
              >{m.label}</button>
            ))}
          </div>
          <span className={styles.modelId}>{activeModel.id}</span>
          <span className={styles.note}>
            <span className={styles.noteMark} aria-hidden="true">◆</span>
            Only affects PRs it hasn&apos;t already started on.
          </span>
        </div>
      </section>

      {/* TRIGGER PHRASES (read-only) */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>Trigger phrases</span>
        </div>
        <p className={styles.sectionDesc}>
          Add these in a comment on your own PRs to call the agent in by hand. Not
          configurable.
        </p>
        <ul className={styles.triggerList}>
          <li className={styles.triggerRow}>
            <span className={styles.triggerHandle}>{s.triggerToken}</span>
            <span className={styles.triggerDesc}>
              Drop this in a comment to trigger agent action on the next poll.
            </span>
          </li>
          <li className={styles.triggerRow}>
            <span className={styles.triggerHandle}>{s.debugToken}</span>
            <span className={styles.triggerDesc}>
              Drop this in a comment to have the agent dig in and post its reasoning,
              without touching code.
            </span>
          </li>
        </ul>
      </section>

      {/* CHECK RULES (read-only, prefix-based — informational, no per-check toggles) */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>Check rules</span>
        </div>
        <p className={styles.sectionDesc}>
          Which automated checks count as needs-you versus ignored.
        </p>
        <ul className={styles.checkList}>
          {(s.complianceChecks || []).map((name) => (
            <li key={`need-${name}`} className={styles.checkRow}>
              <span className={styles.checkName}>{name}</span>
              <span className={styles.pillNeeds}>Needs you</span>
            </li>
          ))}
          {(s.ignoreChecks || []).map((name) => (
            <li key={`ignore-${name}`} className={styles.checkRow}>
              <span className={styles.checkName}>{name}</span>
              <span className={styles.pillIgnore}>Ignore</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ACTIONS */}
      <div className={styles.actions}>
        <Button variant="primary" onClick={save}>Save changes</Button>
        {dirty && <span className={styles.dirtyHint}>Unsaved changes.</span>}
        {saved && !dirty && (
          <Confirmation text="✓ Settings saved." fg="var(--auto-fg)" onUndo={revert} />
        )}
      </div>
    </div>
  );
}
