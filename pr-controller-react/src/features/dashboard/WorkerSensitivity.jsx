import { useRef, useState } from 'react';
import { Badge } from '../../design-system/core/Badge.jsx';
import { Button } from '../../design-system/core/Button.jsx';
import { Confirmation } from '../../design-system/feedback/Confirmation.jsx';
import styles from './WorkerSensitivity.module.css';

/**
 * Worker-sensitivity dial (Settings). One slider that tunes how much each worker
 * resolves on its own vs. brings back to the user. It RENDERS the daemon's
 * `sensitivityLevels` (server-authoritative copy + prompt) and only POSTs the chosen
 * level index via saveConfig({ workerSensitivity }); it derives no routing of its own.
 *
 * The slider is a custom control (no native <input range>) so the rail/fill/notches/seal
 * match the design system. State (working level, dirty/saved) lives in local React state
 * and is carried into CSS via class + the one allowed dynamic inline style (fill width /
 * thumb left as a %). Everything else is tokens in the .module.css.
 */
export default function WorkerSensitivity({ sensitivityLevels = [], settings, saveConfig }) {
  const baseline = clampLevel(settings?.workerSensitivity, sensitivityLevels.length);
  const [working, setWorking] = useState(baseline);
  const [saved, setSaved] = useState(false);
  const trackRef = useRef(null);

  const max = Math.max(0, sensitivityLevels.length - 1);
  const level = sensitivityLevels[working] || sensitivityLevels[0];
  const dirty = working !== baseline;
  const pct = max > 0 ? (working / max) * 100 : 0;

  if (!level) return null;

  function setLevel(next) {
    const clamped = Math.max(0, Math.min(max, next));
    setWorking(clamped);
    if (saved) setSaved(false); // touching the dial clears the saved confirmation
  }

  // Map a pointer x within the track to the nearest level (round the ratio).
  function levelFromClientX(clientX) {
    const el = trackRef.current;
    if (!el) return working;
    const rect = el.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    return Math.round(Math.max(0, Math.min(1, ratio)) * max);
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setLevel(levelFromClientX(e.clientX));
  }
  function onPointerMove(e) {
    if (e.buttons === 0) return; // only while dragging
    setLevel(levelFromClientX(e.clientX));
  }
  function onPointerUp(e) {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  function onKeyDown(e) {
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown': e.preventDefault(); setLevel(working - 1); break;
      case 'ArrowRight':
      case 'ArrowUp': e.preventDefault(); setLevel(working + 1); break;
      case 'Home': e.preventDefault(); setLevel(0); break;
      case 'End': e.preventDefault(); setLevel(max); break;
      default: break;
    }
  }

  async function save() {
    await saveConfig({ workerSensitivity: working });
    setSaved(true);
  }

  return (
    <div className={styles.panel}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.headingText}>
          <span className={styles.eyebrow}>Worker sensitivity</span>
          <h2 className={styles.title}>How much should your workers surface to you?</h2>
          <p className={styles.desc}>
            Sets the instruction every worker follows when it reviews a PR — what it
            resolves on its own versus brings back for your judgment.
          </p>
        </div>
        <Badge tone={level.badgeTone} mono>{level.short}</Badge>
      </header>

      {/* SLIDER */}
      <div className={styles.sliderBlock}>
        <div
          ref={trackRef}
          className={styles.track}
          role="slider"
          tabIndex={0}
          aria-label="Worker sensitivity level"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={working}
          aria-valuetext={level.name}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={onKeyDown}
        >
          <span className={styles.rail} />
          <span className={styles.fill} style={{ width: pct + '%' }} />
          {sensitivityLevels.map((lvl, i) => (
            <span
              key={lvl.key}
              className={styles.tick}
              style={{ left: (max > 0 ? (i / max) * 100 : 0) + '%' }}
            />
          ))}
          <span className={styles.thumb} style={{ left: pct + '%' }} />
        </div>
        <div className={styles.railLabels}>
          <span>← surfaces more to you</span>
          <span>handles more itself →</span>
        </div>
      </div>

      {/* CURRENT SELECTION */}
      <div className={styles.current}>
        <div className={styles.currentHead}>
          <span className={styles.levelName}>{level.name}</span>
          <span className={styles.tagline}>{level.tagline}</span>
        </div>
        <div className={styles.columns}>
          <div className={styles.column}>
            <span className={styles.colEyebrowHandles}>Handles on its own</span>
            <ul className={styles.itemList}>
              {(level.handles || []).map((h, i) => (
                <li key={i} className={styles.item}>
                  <span className={styles.markHandles} aria-hidden="true">✓</span>
                  <span className={styles.itemText}>{h}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.column}>
            <span className={styles.colEyebrowSurfaces}>Brings to you</span>
            <ul className={styles.itemList}>
              {(level.surfaces || []).map((s, i) => (
                <li key={i} className={styles.item}>
                  <span className={styles.markSurfaces} aria-hidden="true">↳</span>
                  <span className={styles.itemText}>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* PROMPT PREVIEW */}
      <div className={styles.promptBlock}>
        <span className={styles.eyebrow}>Added to each worker&apos;s review prompt</span>
        <pre className={styles.promptBox}>{level.prompt}</pre>
      </div>

      {/* HARD-FLOOR NOTE */}
      <p className={styles.floorNote}>
        <span className={styles.floorMark} aria-hidden="true">◆</span>
        An aborted or complex rebase always stops for you — this setting never overrides
        that floor.
      </p>

      {/* ACTIONS */}
      <div className={styles.actions}>
        <Button variant="primary" onClick={save}>Apply to all workers</Button>
        {dirty && <span className={styles.dirtyHint}>Unsaved — applies on your next run.</span>}
        {saved && !dirty && (
          <Confirmation
            text="✓ Sensitivity applied to all workers."
            fg="var(--auto-fg)"
            onUndo={() => { setWorking(baseline); setSaved(false); }}
          />
        )}
      </div>
    </div>
  );
}

// Coerce the saved index to a valid level (mirrors the daemon's clampSensitivity floor:
// non-numbers / out-of-range fall back to the default level 2 rather than throwing).
function clampLevel(n, len) {
  const max = Math.max(0, len - 1);
  const i = Math.round(Number(n));
  if (!Number.isFinite(i)) return Math.min(2, max);
  return Math.max(0, Math.min(max, i));
}
