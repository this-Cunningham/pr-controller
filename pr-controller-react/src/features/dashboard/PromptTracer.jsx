import React from "react";
import { Badge } from "../../design-system/core/Badge.jsx";
import styles from "./PromptTracer.module.css";

/**
 * Prompt tracer — a read-only Settings tab that shows what each headless worker actually
 * receives. It is a pure RENDERER: the daemon assembles every trace from the SAME function
 * the real worker uses (prompt.ts → assembleWorkerPrompt) and serves them at
 * GET /prompt-traces, so this view can never drift from the live prompt, and any fragment
 * later injected into the worker prompt shows up here for free. The dynamic bits the worker
 * fills from a live PR (diff, review threads, branch, SHAs) are shown as `<placeholder>`
 * slots. Pick a situation + sensitivity (and push mode) to watch the net prompt recompose.
 * Each block is colour-coded by source (constant skeleton / from settings / this PR's
 * state) via `data-src`. The sensitivity + push-mode dials are read-only PREVIEWS — they
 * re-fetch an assembled preview and never change the daemon's config.
 */

// Source legend — meaning of each `data-src` colour. Labels come from the daemon segments.
const SRC = {
  const: { label: "constant", meaning: "the skeleton every worker shares" },
  settings: { label: "from settings", meaning: "your sensitivity & check rules" },
  state: { label: "this PR’s state", meaning: "the live thread, diff, CI & conflicts" },
};

const FALLBACK_SHORT = ["surface all", "cautious", "balanced", "trusting", "autonomous"];
const LONG_BODY = 1400; // bodies longer than this (e.g. the house-rules doc) start collapsed

// One assembled block. Long bodies (the house-rules doc) collapse so they don't bury the
// rest of the prompt; everything else renders in full.
function Segment({ seg }) {
  const long = seg.body.length > LONG_BODY;
  const [open, setOpen] = React.useState(!long);
  const lines = seg.body.split("\n").length;
  const shown = open || !long ? seg.body : seg.body.slice(0, 700).trimEnd() + "\n…";
  return (
    <div className={styles.segCard} data-src={seg.src}>
      <div className={styles.segCardHead}>
        <span className={styles.segLabel}>{seg.label}</span>
        <span className={styles.segChip} data-src={seg.src}>{SRC[seg.src]?.label || seg.src}</span>
      </div>
      <div className={styles.segBody}>{shown}</div>
      {long && (
        <button type="button" className={styles.collapseBtn} onClick={() => setOpen((v) => !v)}>
          {open ? "Collapse" : `Show full · ${lines} lines`}
        </button>
      )}
    </div>
  );
}

export default function PromptTracer({ sensitivityLevels = [], settings = null }) {
  const levels = Array.isArray(sensitivityLevels) ? sensitivityLevels : [];
  const defaultLevel = Number.isInteger(settings?.workerSensitivity) ? settings.workerSensitivity : 2;

  const [level, setLevel] = React.useState(defaultLevel);
  const [detached, setDetached] = React.useState(false);
  const [sel, setSel] = React.useState(null);
  const [traces, setTraces] = React.useState([]);
  const [model, setModel] = React.useState(settings?.workerModel || "");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  // Re-fetch the assembled previews whenever a dial moves. Stale-while-revalidate: keep the
  // current traces on screen during the refetch so switching sensitivity doesn't flash empty.
  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/prompt-traces?sensitivity=${level}&detached=${detached ? 1 : 0}`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        if (!data?.ok || !Array.isArray(data.traces)) throw new Error(data?.error || "bad response");
        setTraces(data.traces);
        if (data.model) setModel(data.model);
        setError(null);
        // Keep the current situation selected if it still exists; else fall back to the first.
        setSel((cur) => (data.traces.some((t) => t.key === cur) ? cur : data.traces[0]?.key || null));
      })
      .catch((e) => { if (alive) setError(String(e?.message || e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [level, detached]);

  const trace = traces.find((t) => t.key === sel) || traces[0] || null;
  const segs = trace?.segments || [];
  const tokens = Math.round(segs.reduce((n, s) => n + s.body.length + s.label.length, 0) / 4 / 5) * 5;
  const levelName = levels[level]?.name || `level ${level}`;
  const levelShorts = levels.length ? levels.map((l) => l.short) : FALLBACK_SHORT;

  const feedChips = [
    model && { label: model, tone: "neutral", mono: true },
    { label: "sensitivity: " + levelName, tone: "neutral", mono: false },
    { label: detached ? "push: detached HEAD" : "push: on branch", tone: "neutral", mono: false },
  ].filter(Boolean);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.eyebrow}>Prompt tracer{loading ? " · updating…" : ""}</div>
          <h2 className={styles.title}>What each worker actually receives</h2>
          <p className={styles.desc}>
            The real prompt skeleton, assembled by the daemon from the same code the worker runs — with the
            per-PR bits (<code className={styles.tok}>&lt;pr-diff&gt;</code>, <code className={styles.tok}>&lt;review-thread-data&gt;</code>,
            …) shown as templated slots. Pick a situation to see what changes.
          </p>
        </div>
        <span className={styles.headerBadge}>
          <Badge tone="neutral" mono>{segs.length} blocks</Badge>
        </span>
      </div>

      {error && (
        <div className={styles.errorNote}>Couldn’t load the live prompt traces ({error}). Is the daemon running?</div>
      )}

      {/* Situation picker — the real run situations the dispatcher produces */}
      <div className={styles.section}>
        <div className={styles.eyebrow}>Pick a worker situation</div>
        <div className={styles.scenarioGrid}>
          {traces.map((t) => (
            <button
              key={t.key}
              type="button"
              className={styles.scenario}
              data-active={t.key === (trace?.key) ? "true" : undefined}
              onClick={() => setSel(t.key)}
            >
              <span className={styles.scenarioLabel}>{t.label}</span>
              <span className={styles.scenarioSub}>{t.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Feeding chips */}
      <div className={`${styles.section} ${styles.divider}`}>
        <div className={styles.eyebrow}>Feeding this prompt</div>
        <div className={styles.chipRow}>
          {feedChips.map((c, i) => (
            <Badge key={i} tone={c.tone} mono={c.mono}>{c.label}</Badge>
          ))}
        </div>
      </div>

      {/* Sensitivity inline control — a read-only preview dial */}
      <div className={styles.section}>
        <div className={styles.sensitivityHead}>
          <div className={styles.eyebrow}>
            Sensitivity policy <span className={styles.eyebrowSoft}>· preview · from your settings</span>
          </div>
          <div className={styles.sensitivityNote}>rewrites the green block below</div>
        </div>
        <div className={styles.seg} role="group" aria-label="Sensitivity policy">
          {levelShorts.map((short, i) => (
            <button
              key={short}
              type="button"
              className={styles.segItem}
              data-active={i === level ? "true" : undefined}
              onClick={() => setLevel(i)}
            >
              {short}
            </button>
          ))}
        </div>
      </div>

      {/* Push-mode toggle — another situational dial */}
      <div className={styles.section}>
        <div className={styles.sensitivityHead}>
          <div className={styles.eyebrow}>
            Push mode <span className={styles.eyebrowSoft}>· how the worker is told to push</span>
          </div>
        </div>
        <div className={styles.seg} role="group" aria-label="Push mode">
          <button type="button" className={styles.segItem} data-active={!detached ? "true" : undefined} onClick={() => setDetached(false)}>on branch</button>
          <button type="button" className={styles.segItem} data-active={detached ? "true" : undefined} onClick={() => setDetached(true)}>detached HEAD</button>
        </div>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        {["const", "settings", "state"].map((k) => (
          <div key={k} className={styles.legendItem}>
            <span className={styles.swatch} data-src={k} />
            <span className={styles.legendText}>
              <b className={styles.legendName} data-src={k}>{SRC[k].label}</b> — {SRC[k].meaning}
            </span>
          </div>
        ))}
      </div>

      {/* Assembled prompt */}
      <div className={`${styles.section} ${styles.divider}`}>
        <div className={styles.promptHead}>
          <div className={styles.eyebrow}>Net prompt sent to the worker</div>
          <div className={styles.promptMeta}>{segs.length} blocks · ~{tokens} tokens</div>
        </div>
        <div className={styles.segments}>
          {segs.map((sg, i) => (
            <Segment key={sg.id || i} seg={sg} />
          ))}
        </div>
      </div>

      {/* Footnote */}
      <div className={styles.footnote}>
        <span className={styles.footMark}>◆</span>
        <span>
          Read-only — assembled live by the daemon (<code className={styles.tok}>GET /prompt-traces</code>) from the same
          code path the worker runs, so it always matches the real prompt. Tune the green block in Worker sensitivity;
          the accent blocks are filled per-PR at dispatch.
        </span>
      </div>
    </div>
  );
}
