// Worker sensitivity — a single dial that tunes how much each worker resolves on its
// own versus brings back for the user's judgment. Pure data + lookups (no I/O), so it's
// testable and has ONE home: the daemon injects the active level's `prompt` into every
// worker run (worker.mjs), and the dashboard renders the level metadata (Settings →
// Worker sensitivity) from the same array shipped in state.json — so the instruction the
// worker follows and the copy the user reads can never drift apart.
//
// HARD FLOOR (not overridable here): an aborted or complex rebase ALWAYS stops for the
// user. That floor lives in the worker prompt + the dispatcher's conflict handling; this
// dial only moves the threshold for ordinary review threads.

// Ordered low → high autonomy. `prompt` is appended to each worker's review prompt;
// everything else is presentational (rendered by the Settings slider). `badgeTone` is a
// design-system Badge tone (urgent | neutral | active). Index = level (0..4).
export const SENSITIVITY_LEVELS = [
  {
    key: 'surface-all', name: 'Surface everything', short: 'surface all', badgeTone: 'urgent',
    tagline: 'Maximum oversight. The worker drafts a response to every thread but waits for your nod before it changes code or replies.',
    handles: ['Nothing is applied or sent without your approval'],
    surfaces: ['Every reviewer thread, with a reply drafted', 'Mechanical nits & style notes', 'All CI and branch warnings'],
    prompt: 'For every reviewer thread, draft a reply but do NOT apply any change or send any response without explicit approval. Surface all feedback as "needs your input", including mechanical nits. Never auto-resolve.',
  },
  {
    key: 'cautious', name: 'Cautious', short: 'cautious', badgeTone: 'neutral',
    tagline: 'Clears the busywork. Anything that involves a judgment call still comes to you.',
    handles: ['Formatting, lint & lockfile regeneration', 'Pure renames with no behavior change'],
    surfaces: ['Anything involving a judgment call', 'Naming intent & scope questions', 'Behavior or API changes'],
    prompt: 'Auto-apply only purely mechanical changes (formatting, lint, renames, lockfile regen) and reply "fixed". Surface everything that involves a judgment call as "needs your input" with a drafted reply.',
  },
  {
    key: 'balanced', name: 'Balanced', short: 'balanced', badgeTone: 'neutral',
    tagline: 'The default. The worker handles the clear-cut requests and brings the decisions that change product behavior.',
    handles: ['Mechanical changes', 'Low-risk fixes the reviewer clearly asked for'],
    surfaces: ['Product & architecture decisions', 'Anything that changes runtime behavior', 'Merge conflicts'],
    prompt: 'Auto-apply mechanical changes and low-risk fixes the reviewer clearly requested. Surface product decisions, architecture changes, and anything altering runtime behavior as "needs your input", with a drafted reply or proposed approach.',
  },
  {
    key: 'trusting', name: 'Trusting', short: 'trusting', badgeTone: 'active',
    tagline: 'Hands most of the review back to the worker. Only the genuinely high-stakes calls reach you.',
    handles: ['Most review feedback, end-to-end', 'Moderate refactors & config changes', 'Unambiguous rebases'],
    surfaces: ['High-impact disputes — security, data, public API', 'Risky migrations'],
    prompt: 'Resolve most review feedback end-to-end, including moderate refactors and config changes, and reply on my behalf. Only surface high-impact disputes (security, data integrity, public API or contract changes) and risky migrations.',
  },
  {
    key: 'autonomous', name: 'Fully autonomous', short: 'autonomous', badgeTone: 'active',
    tagline: "The worker runs the whole review. It only stops you when a rebase can't be finished safely.",
    handles: ['Every reviewer thread — replies & pushes fixes', 'Product calls when intent is clear', 'All clean rebases & merges'],
    surfaces: ['Only an aborted or complex rebase'],
    prompt: 'Resolve, reply to, and push fixes for all reviewer feedback without asking. Make the product call yourself when intent is reasonably clear. Only stop and surface to me when a rebase is aborted or the conflict is too complex to resolve safely.',
  },
];

export const DEFAULT_SENSITIVITY = 2; // 'balanced'

// Coerce any input to a valid level index. Non-numbers / out-of-range fall back to the
// default rather than throwing, so a drifted config or bad POST can't wedge dispatch.
export function clampSensitivity(n: number | string | null | undefined): number {
  if (n == null || n === '') return DEFAULT_SENSITIVITY;  // Number(null/'') is 0, not NaN — guard it
  const i = Math.round(Number(n));
  if (!Number.isFinite(i)) return DEFAULT_SENSITIVITY;
  return Math.max(0, Math.min(SENSITIVITY_LEVELS.length - 1, i));
}

// The instruction appended to a worker's review prompt for the active level. The hard
// rebase floor is restated alongside it so a high level can't read as "ignore the floor".
export function sensitivityPrompt(level: number | string | null | undefined): string {
  const L = SENSITIVITY_LEVELS[clampSensitivity(level)];
  return `${L.prompt}\nFLOOR (always): an aborted or complex rebase still stops for the user — this setting never overrides that.`;
}
