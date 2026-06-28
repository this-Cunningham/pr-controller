import React from "react";
import { Badge } from "../../design-system/core/Badge.jsx";
import styles from "./PromptTracer.module.css";

/**
 * Prompt tracer — a read-only Settings tab that shows what each headless worker
 * actually receives: one assembled instruction, rebuilt per thread from a fixed
 * skeleton (constant), your settings (sensitivity + check rules), and the live state
 * of the PR. Pick a worker situation and a sensitivity level to watch the net prompt
 * recompose. It's an explainer, not a control — entirely illustrative (canned
 * scenarios + the same sensitivity ladder Worker sensitivity exposes); the daemon
 * owns the real prompt (worker.ts / worker-prompt.md). Each block is colour-coded by
 * source (constant / from settings / this PR's state) via `data-src`.
 */
const MODEL = "claude-sonnet-4";

// The sensitivity ladder, mirroring the daemon's levels (sensitivity.ts). Each level's
// prompt is the policy paragraph the worker is handed — it rewrites the "from settings"
// block below.
const LEVELS = [
  { short: "Surface all", name: "Surface everything",
    prompt: "For every reviewer thread, draft a reply but do NOT apply any change or send any response without explicit approval. Surface all feedback as “needs your input”, including mechanical nits. Never auto-resolve." },
  { short: "Cautious", name: "Cautious",
    prompt: "Auto-apply only purely mechanical changes (formatting, lint, renames, lockfile regen) and reply “fixed”. Surface everything that involves a judgment call as “needs your input” with a drafted reply." },
  { short: "Balanced", name: "Balanced",
    prompt: "Auto-apply mechanical changes and low-risk fixes the reviewer clearly requested. Surface product decisions, architecture changes, and anything altering runtime behavior as “needs your input”, with a drafted reply or proposed approach." },
  { short: "Trusting", name: "Trusting",
    prompt: "Resolve most review feedback end-to-end, including moderate refactors and config changes, and reply on my behalf. Only surface high-impact disputes (security, data integrity, public API or contract changes) and risky migrations." },
  { short: "Autonomous", name: "Fully autonomous",
    prompt: "Resolve, reply to, and push fixes for all reviewer feedback without asking. Make the product call yourself when intent is reasonably clear. Only stop and surface to me when a rebase is aborted or the conflict is too complex to resolve safely." },
];

// Canned worker situations — each varies the PR's live state (review, CI, conflict,
// missing ticket) and the reviewer thread, so the assembled prompt visibly changes.
const SCEN = [
  {
    key: "dispute", label: "Disputed change",
    sub: "conflict · CI red · surfaced to you",
    repo: "acme/web-app", num: 2412, title: "Refactor auth middleware to support SSO",
    review: "Review required", baseText: "12 commits behind main", checksLine: "unit-api failing",
    ci: [{ name: "unit-api", mode: "attention" }],
    conflict: "This branch conflicts with main in src/auth/middleware.ts — the overlap is exactly the token-refresh guard the reviewer is defending. Non-trivial; do not auto-resolve.",
    missingTicket: false,
    thread: { author: "@dana-k", loc: "src/auth/middleware.ts:88",
      body: "This breaks the existing token-refresh path — we short-circuit on expired tokens so the client can silently re-auth. If you drop the early return, every expired request 500s instead of refreshing. Please keep the guard." },
    output: "→ SURFACE — this is the human's call. Change nothing and post nothing to the reviewer yet. Return a one-line reason plus a drafted reply they can edit and send.\nOutcome on the board: “needs your input”.",
    chips: [{ label: "12 behind base" }, { label: "CI red: unit-api" }, { label: "merge conflict" }],
  },
  {
    key: "nit", label: "Mechanical nit",
    sub: "clean PR · auto-applied",
    repo: "acme/web-app", num: 2399, title: "Bump lodash to 4.17.21",
    review: "Approved", baseText: "even with main", checksLine: "all green",
    ci: [], conflict: null, missingTicket: false,
    thread: { author: "@deps-bot", loc: "package.json:24",
      body: "Lockfile is out of sync with package.json." },
    output: "→ RESOLVE — mechanical and clearly requested. Regenerate the lockfile, reply “fixed” on the thread, and leave it open for @deps-bot to confirm.\nOutcome on the board: “agent fixed · waiting”.",
    chips: [{ label: "clean · approved", tone: "active" }],
  },
  {
    key: "arch", label: "Architecture call",
    sub: "draft · ignored CI · drafts an approach",
    repo: "acme/data-pipeline", num: 874, title: "Add backfill job for the events table",
    review: "Draft", baseText: "even with main", checksLine: "lint failing (ignored by your rules)",
    ci: [{ name: "lint", mode: "ignore" }], conflict: null, missingTicket: true,
    thread: { author: "@priya", loc: "jobs/backfill.py:55",
      body: "Backfilling synchronously will hold a lock on events for hours in prod. This needs to be chunked with checkpoints, or run against a replica. I’d block on this." },
    output: "→ SURFACE with a proposed approach. The fix changes runtime behavior, so apply nothing. Return a one-line reason and a drafted approach — chunked checkpoints against a read replica — for approval.\nOutcome on the board: “needs your input · approach drafted”.",
    chips: [{ label: "draft" }, { label: "CI: lint (ignored)" }, { label: "no ticket" }],
  },
  {
    key: "rebase", label: "Rebase conflict",
    sub: "rename clash · stopped at the floor",
    repo: "acme/design-system", num: 561, title: "Tokenize the spacing scale",
    review: "Review required", baseText: "3 commits behind main", checksLine: "all green",
    ci: [],
    conflict: "A rebase onto main surfaced a rename/rename conflict in tokens/spacing.json — both branches renamed the same keys. Choosing a side would silently drop one rename, so by the floor above you must stop and surface, not pick a winner.",
    missingTicket: false,
    thread: { author: "@lee", loc: "tokens/spacing.json:12",
      body: "Base unit should be four px, not five — matches the grid." },
    output: "→ SURFACE the rebase. The @lee nit is mechanical and you'd normally just fix it, but the rename clash blocks a clean rebase and trips the floor. Stop, summarize the conflict, and hand it back.\nOutcome on the board: “rebase — needs you”.",
    chips: [{ label: "3 behind base" }, { label: "rebase conflict" }],
  },
  {
    key: "error", label: "Unclassifiable failure",
    sub: "CI parse error · agent stuck",
    repo: "acme/api", num: 990, title: "Add rate limiting to the public API",
    review: "Review required", baseText: "even with main", checksLine: "1 workflow failed to start",
    ci: [], conflict: null, missingTicket: false,
    thread: { author: "@ci-bot", loc: ".github/workflows/ci.yml:30",
      body: "Step “cache restore” failed to parse — unexpected key “path” at line 30." },
    output: "→ CANNOT CLASSIFY. The run failed before any review ran, with a YAML parse error you don't have enough context to fix safely. Don't guess. Mark agent-error and open a terminal for the human.\nOutcome on the board: “agent error”.",
    chips: [{ label: "workflow parse error", tone: "error" }],
  },
];

// Source of each block. Colour lives in CSS (data-src): constant → ink, from settings →
// sage, this PR's state → accent.
const SRC = {
  const: { label: "constant", meaning: "the skeleton every worker shares" },
  settings: { label: "from settings", meaning: "your sensitivity & check rules" },
  state: { label: "this PR’s state", meaning: "the live thread, CI & conflicts" },
};

// Badge tones are neutral|active|urgent|praise|outline; the prototype's "error" chip
// maps to the closest available tone.
const badgeTone = (t) => (t === "error" ? "urgent" : t || "urgent");

// Assemble the net prompt the way the worker layer does: skeleton, then policy, then the
// hard floor, then the PR's live state, then the thread, then the expected output.
function buildSegments(sc, L) {
  const segs = [];
  segs.push({ src: "const", label: "Worker role",
    body: `You are a PR-review worker on ${sc.repo}, running ${MODEL}. A teammate owns this pull request; you act on their behalf. Take the one open reviewer thread below and decide — under the policy — whether to resolve it yourself or bring it back for their judgment.` });

  segs.push({ src: "settings", label: "Sensitivity policy — " + L.name, body: L.prompt });

  segs.push({ src: "const", label: "Hard floor",
    body: "An aborted or complex rebase always stops for the human. This floor sits above the policy — never resolve a conflict you are not certain of." });

  if (sc.ci && sc.ci.length) {
    const lines = sc.ci.map((c) => c.mode === "ignore"
      ? `• ${c.name} is red — your rules mark it ignore, so don't block on it or comment about it.`
      : `• ${c.name} is red — your rules mark it needs-you, so treat it as blocking.`);
    segs.push({ src: "settings", label: "Status-check rules",
      body: "Failing checks on this PR, read against your check rules:\n" + lines.join("\n") });
  }

  segs.push({ src: "state", label: "Pull-request state",
    body: [`${sc.repo} #${sc.num} — “${sc.title}”`, `Review: ${sc.review}`, `Base: ${sc.baseText}`, `Checks: ${sc.checksLine}`].join("\n") });

  if (sc.conflict) segs.push({ src: "state", label: "Merge / rebase state", body: sc.conflict });

  if (sc.missingTicket) segs.push({ src: "state", label: "Tracker",
    body: "No issue ticket is linked to this PR. Surface that to the human — do not invent or guess a ticket id." });

  segs.push({ src: "state", label: "Reviewer thread",
    body: `${sc.thread.author} commented at ${sc.thread.loc}:\n“${sc.thread.body}”` });

  segs.push({ src: "const", label: "Expected output", body: sc.output });

  return segs;
}

export default function PromptTracer() {
  const [sel, setSel] = React.useState("dispute");
  const [level, setLevel] = React.useState(2);

  const scen = SCEN.find((s) => s.key === sel) || SCEN[0];
  const L = LEVELS[level];
  const segs = buildSegments(scen, L);
  const tokens = Math.round(segs.reduce((n, s) => n + s.body.length + s.label.length, 0) / 4 / 5) * 5;

  const feedChips = [
    { label: `${scen.repo} #${scen.num}`, tone: "neutral", mono: true },
    { label: MODEL, tone: "neutral", mono: true },
    { label: "sensitivity: " + L.name, tone: "neutral", mono: false },
    ...scen.chips.map((c) => ({ label: c.label, tone: badgeTone(c.tone), mono: false })),
  ];

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.eyebrow}>Prompt tracer</div>
          <h2 className={styles.title}>What each worker actually receives</h2>
          <p className={styles.desc}>
            One assembled instruction, rebuilt per thread from a fixed skeleton, your settings, and the live state of the
            PR. Pick a situation to see what changes.
          </p>
        </div>
        <span className={styles.headerBadge}>
          <Badge tone="neutral" mono>{segs.length} blocks</Badge>
        </span>
      </div>

      {/* Scenario picker */}
      <div className={styles.section}>
        <div className={styles.eyebrow}>Pick a worker situation</div>
        <div className={styles.scenarioGrid}>
          {SCEN.map((s) => (
            <button
              key={s.key}
              type="button"
              className={styles.scenario}
              data-active={s.key === sel ? "true" : undefined}
              onClick={() => setSel(s.key)}
            >
              <span className={styles.scenarioLabel}>{s.label}</span>
              <span className={styles.scenarioSub}>{s.sub}</span>
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

      {/* Sensitivity inline control */}
      <div className={styles.section}>
        <div className={styles.sensitivityHead}>
          <div className={styles.eyebrow}>
            Sensitivity policy <span className={styles.eyebrowSoft}>· from your settings</span>
          </div>
          <div className={styles.sensitivityNote}>rewrites the green block below</div>
        </div>
        <div className={styles.seg} role="group" aria-label="Sensitivity policy">
          {LEVELS.map((lv, i) => (
            <button
              key={lv.short}
              type="button"
              className={styles.segItem}
              data-active={i === level ? "true" : undefined}
              onClick={() => setLevel(i)}
            >
              {lv.short}
            </button>
          ))}
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
            <div key={i} className={styles.segCard} data-src={sg.src}>
              <div className={styles.segCardHead}>
                <span className={styles.segLabel}>{sg.label}</span>
                <span className={styles.segChip} data-src={sg.src}>{SRC[sg.src].label}</span>
              </div>
              <div className={styles.segBody}>{sg.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footnote */}
      <div className={styles.footnote}>
        <span className={styles.footMark}>◆</span>
        <span>
          Read-only — this is generated, not edited. Tune the green blocks in Worker sensitivity and Agent setup; the
          accent blocks come straight from each PR.
        </span>
      </div>
    </div>
  );
}
