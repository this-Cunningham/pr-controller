// The worker prompt, assembled in ONE place. `runWorker` (worker.ts) builds the real
// prompt from live PR data; the Prompt-tracer endpoint (server.ts /prompt-traces) builds
// the SAME structure from templated placeholders. Because both go through
// `assembleWorkerPrompt`, the tracer can never drift from what workers actually receive,
// and any prompt fragment added here shows up in the tracer for free.
//
// The function is PURE (no I/O): callers resolve the dynamic bits — the house-rules doc,
// the diff, the threads JSON, the sensitivity text, the failing-check lines — into the
// `PromptContext` slots, as either real strings (worker) or `<placeholder>` tokens
// (tracer). The branching LOGIC (run type, rebase yes/no, threads vs none, recovered
// prepend, push mode) lives here so it has a single home.
import { sensitivityPrompt } from './sensitivity.ts';
import type { Check } from './types.ts';

// Where a block comes from — drives the tracer's colour coding (constant skeleton /
// your settings / this PR's live state). Display-only; the worker ignores it.
export type PromptSource = 'const' | 'settings' | 'state';

// One labelled block of the assembled prompt. `body` is the literal text that goes to the
// worker; concatenating every segment's `body` with '\n' reproduces the net prompt
// verbatim (see `renderPrompt`). An empty `body` is a structurally-present-but-omitted
// block (e.g. no branch-health this run) — kept for join parity, filtered for display.
export interface PromptSegment {
  id: string;
  src: PromptSource;
  label: string;
  body: string;
}

// One named worker situation for the tracer (first run, resume, rebase, …), pre-assembled
// with placeholder slots. `segments` already has empty blocks filtered out.
export interface PromptTrace {
  key: string;
  label: string;
  sub: string;
  segments: PromptSegment[];
}

type RunType = 'first' | 'resume' | 'applyApproved';

// Everything the assembler needs, already resolved by the caller. Real strings for the
// worker; `<placeholder>` tokens for the tracer. Flags drive the structural branches.
export interface PromptContext {
  runType: RunType;
  recovered: boolean;          // prepend the interrupted-run notice (ignored on a first run)
  rules: string;               // worker-prompt.md contents (first run only)
  diffMode: 'inline' | 'truncated' | 'none';
  diffSlot: string;            // the unified diff (inline) or the changed-files list (truncated)
  since: string | null;        // last-seen SHA — drives the `git diff <since>..HEAD` wording
  prRef: string;               // "owner/repo#123 — Title"
  worktreePath: string;
  outPath: string;
  detached: boolean;           // push mode: detached HEAD vs on-branch
  pushRefspec: string;         // refspec for the detached `git push origin <refspec>`
  headRefName: string;         // branch name (push line + recovered notice)
  sensitivityText: string;     // sensitivityPrompt(level) — the policy paragraph + floor
  health: {
    present: boolean;          // emit the Branch-health block at all
    mergeable: string;
    mergeState: string;
    checkState: string;
    failingChecks: string;     // pre-rendered list lines (renderFailingChecks) or '' for none
    rebase: boolean;           // REBASE this run: YES vs NO
    base: string;              // base branch (rebase target)
  };
  threadsSlot: string | null;  // rendered review-thread data, or null for a branch-health-only run
}

// ── House-rules-independent prompt fragments (verbatim copies of worker.ts's strings,
//    parameterised). Keeping them here makes the tracer a literal mirror. ──────────────

const pushNoteFor = (c: PromptContext) =>
  c.detached
    ? `\nPush mode: DETACHED HEAD — commit then \`git push origin ${c.pushRefspec}\`. Do not switch branches.`
    : `\nPush mode: on branch ${c.headRefName} — commit then \`git push\`.`;

const diffSection = (mode: PromptContext['diffMode'], slot: string) =>
  mode === 'inline'
    ? `\n## Familiarize yourself with this PR FIRST\nThis is the PR diff. Read it and open the changed files in the worktree so you understand what this PR does and which choices are deliberate. You will REMEMBER this understanding for every future round — it is not sent again.\n\`\`\`diff\n${slot}\n\`\`\``
    : mode === 'truncated'
      ? `\n## Familiarize yourself with this PR FIRST\nThe diff is too large to inline. Open these changed files in the worktree and read them so you understand what this PR does and which choices are deliberate. You will REMEMBER this understanding for every future round — it is not sent again.\nChanged files:\n${slot}`
      : '';

const recoveredNotice = (headRefName: string) =>
  `NOTE: your previous run on this PR was interrupted before it finished and the worktree was reset to origin/${headRefName}, so any uncommitted changes from that run are gone — re-read the current files before acting.`;

// The run-mode header (everything before "## This task"), minus the first-run diff and the
// optional recovered prepend. Returns the array of lines that worker.ts spreads into `head`.
function runModeLines(c: PromptContext): string[] {
  if (c.runType === 'applyApproved') {
    return [
      'APPLY-APPROVED RUN. The user APPROVED an approach you previously proposed on the thread(s) below — it is no longer a surface. Carry it out NOW as a normal fix (make the change, commit, push, reply `fixed`, leave the thread open). You already reasoned about these threads; pick up that analysis rather than re-deriving it.',
      c.since
        ? `To re-ground first: run \`git diff ${c.since}..HEAD\` in the worktree to see what moved since your last run, then re-read the files for these threads as they are NOW.`
        : `To re-ground first: re-read the files for these threads as they are NOW (the branch may have moved).`,
    ];
  }
  return [
    'RESUME RUN. New reviewer feedback arrived on this PR. You already understand this PR from earlier rounds — do NOT re-read everything; just re-ground on the delta.',
    c.since
      ? `Run \`git diff ${c.since}..HEAD\` in the worktree to see ONLY what moved since your last run, then re-read just the files touched by the new threads as they are NOW.`
      : `Re-read just the files referenced by the new threads, as they are NOW (the branch may have moved).`,
  ];
}

const REBASE_NO = `\nREBASE this run: NO — do not rebase. Fix CI only if it's caused by your changes (see "Branch health" in the house rules).`;
const rebaseYes = (base: string) =>
  `\nREBASE this run: YES — the branch conflicts with its base (${base}). Run \`git rebase origin/${base}\` — onto the REMOTE base origin/${base}, NOT a local ref (your local ${base} would be stale and hide the conflict). Do NOT run \`git fetch\` yourself: the daemon already fetched origin/${base} for you under a per-clone lock, and a second concurrent fetch on the shared clone would race on its refs. Resolve the conflicts; if it applies cleanly, push with \`--force-with-lease\`. If the conflicts are NOT trivial to resolve safely, STOP and surface it via \`branchHealth.surfaced\` — do not guess through a messy merge.`;

function healthBlock(c: PromptContext): string {
  const h = c.health;
  if (!h.present) return '';
  return `\n## Branch health\nmergeable=${h.mergeable} mergeState=${h.mergeState} checks=${h.checkState}`
    + (h.failingChecks ? `\nfailing checks:\n${h.failingChecks}` : '')
    + (h.rebase ? rebaseYes(h.base) : REBASE_NO);
}

function threadsBlock(c: PromptContext): string {
  const heading = c.runType === 'applyApproved'
    ? `\n## Approved threads — execute the approach you proposed on each`
    : `\n## New/changed unresolved threads`;
  return c.threadsSlot != null
    ? `${heading}\n${c.threadsSlot}`
    : `\n## No new review threads this run — you were dispatched for branch health only.`;
}

// Render the failing-check lines exactly as the worker sees them (run-id + rerun hint
// parsed from each check's Actions URL). The "failing checks:" label is added by the
// branch-health block, so this returns just the joined `- name [state] url …` lines.
export function renderFailingChecks(checks: Check[]): string {
  return checks.map((c) => {
    const runId = (c.url || '').match(/\/actions\/runs\/(\d+)/)?.[1];
    return `- ${c.name} [${c.state}] ${c.url || ''}${runId ? ` — rerun: gh run rerun ${runId} --failed` : ''}`;
  }).join('\n');
}

// Assemble the worker prompt as labelled segments. `renderPrompt(assembleWorkerPrompt(c))`
// reproduces the net prompt string byte-for-byte (test/prompt.test.ts locks this against
// the original worker.ts assembly). Segment order + grouping mirror worker.ts's `task`
// array so the '\n' join is identical.
export function assembleWorkerPrompt(c: PromptContext): PromptSegment[] {
  const segs: PromptSegment[] = [];

  if (c.runType === 'first') {
    segs.push({ id: 'house-rules', src: 'const', label: 'House rules (worker-prompt.md)', body: c.rules });
    segs.push({ id: 'familiarize', src: 'state', label: 'Familiarize yourself with this PR', body: diffSection(c.diffMode, c.diffSlot) });
  } else {
    if (c.recovered)
      segs.push({ id: 'recovered', src: 'const', label: 'Recovered-run notice', body: recoveredNotice(c.headRefName) });
    segs.push({ id: 'run-mode', src: 'const', label: c.runType === 'applyApproved' ? 'Apply-approved run' : 'Resume run', body: runModeLines(c).join('\n') });
  }

  segs.push({
    id: 'this-task', src: 'state', label: 'This task',
    body: [
      `\n## This task`,
      `PR: ${c.prRef}`,
      `Worktree: ${c.worktreePath}`,
      pushNoteFor(c).trimStart(),
      `Write your result JSON to: ${c.outPath}`,
    ].join('\n'),
  });

  segs.push({ id: 'sensitivity', src: 'settings', label: 'How much to surface vs. handle yourself', body: `\n## How much to surface vs. handle yourself\n${c.sensitivityText}` });
  segs.push({ id: 'branch-health', src: 'state', label: 'Branch health', body: healthBlock(c) });
  segs.push({ id: 'threads', src: 'state', label: c.runType === 'applyApproved' ? 'Approved threads' : 'Review threads', body: threadsBlock(c) });

  return segs;
}

// The net prompt string the worker is handed. Concatenation with '\n' — exactly worker.ts's
// `task` join. Empty segments are kept (they preserve the blank lines of the original).
export function renderPrompt(segments: PromptSegment[]): string {
  return segments.map((s) => s.body).join('\n');
}

// ── Tracer: the templated situations ─────────────────────────────────────────────────
// Each situation is a PromptContext whose dynamic slots are `<placeholder>` tokens, so the
// tracer shows the prompt SKELETON for that situation without needing a live PR. The
// constant house-rules doc and the (real) sensitivity text are passed through verbatim.

const PH = {
  prRef: '<owner/repo#123 — PR title>',
  worktree: '<worktree-path>',
  outPath: '<result-json-path>',
  diff: '<pr-diff>',
  files: '<changed-files>',
  sha: '<last-run-sha>',
  branch: '<branch>',
  base: '<base-branch>',
  refspec: 'HEAD:<branch>',
  threads: '<review-thread-data>',
  failing: '<failing-checks>',
  mergeable: '<mergeable>',
  mergeState: '<merge-state>',
  checkState: '<check-state>',
};

// Shared placeholder slots; each situation overrides the structural flags it exercises.
function baseCtx(rules: string, sensitivityText: string): PromptContext {
  return {
    runType: 'resume', recovered: false, rules,
    diffMode: 'none', diffSlot: '',
    since: PH.sha, prRef: PH.prRef, worktreePath: PH.worktree, outPath: PH.outPath,
    detached: false, pushRefspec: PH.refspec, headRefName: PH.branch,
    sensitivityText,
    health: { present: false, mergeable: PH.mergeable, mergeState: PH.mergeState, checkState: PH.checkState, failingChecks: '', rebase: false, base: PH.base },
    threadsSlot: PH.threads,
  };
}

// Build the tracer's situations for a given sensitivity level + push mode. `rules` is the
// real worker-prompt.md (read by the caller); `sensitivity`/`detached` mirror the dials.
export function buildPromptTraces(opts: { rules: string; sensitivity: number; detached?: boolean }): PromptTrace[] {
  const sens = sensitivityPrompt(opts.sensitivity);
  const detached = !!opts.detached;
  const base = (over: Partial<PromptContext>): PromptContext => ({ ...baseCtx(opts.rules, sens), detached, ...over });

  const situations: Array<{ key: string; label: string; sub: string; ctx: PromptContext }> = [
    {
      key: 'first', label: 'First run', sub: 'new session · full diff + house rules',
      ctx: base({ runType: 'first', diffMode: 'inline', diffSlot: PH.diff }),
    },
    {
      key: 'resume', label: 'Resume — new feedback', sub: 'later round · delta only',
      ctx: base({ runType: 'resume' }),
    },
    {
      key: 'applyApproved', label: 'Apply-approved', sub: 'you approved an approach',
      ctx: base({ runType: 'applyApproved' }),
    },
    {
      key: 'rebase', label: 'Rebase needed', sub: 'branch conflicts with base · rebase-only',
      ctx: base({
        runType: 'resume', threadsSlot: null,
        health: { present: true, mergeable: PH.mergeable, mergeState: PH.mergeState, checkState: PH.checkState, failingChecks: '', rebase: true, base: PH.base },
      }),
    },
    {
      key: 'ciFailing', label: 'CI failing', sub: 'checks red · fix what you caused',
      ctx: base({
        runType: 'resume',
        health: { present: true, mergeable: PH.mergeable, mergeState: PH.mergeState, checkState: PH.checkState, failingChecks: PH.failing, rebase: false, base: PH.base },
      }),
    },
    {
      key: 'recovered', label: 'Recovered resume', sub: 'previous run was interrupted',
      ctx: base({ runType: 'resume', recovered: true }),
    },
  ];

  return situations.map((s) => ({
    key: s.key, label: s.label, sub: s.sub,
    // Drop structurally-empty blocks (e.g. no branch-health) so the tracer shows no blank cards.
    segments: assembleWorkerPrompt(s.ctx).filter((seg) => seg.body.trim() !== ''),
  }));
}
