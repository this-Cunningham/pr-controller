// Worker dispatch: spawns a headless `claude -p` scoped to ONE PR. Scope is
// enforced upstream by `config.onlyPRs` (the poller only ever hands us in-scope PRs).
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { config, ghEnv } from './config.mjs';
import { fetchDiff } from './scanner.mjs';
import { validateWorkerResult } from './rules.mjs';

const exec = promisify(execFile);
const SESSIONS = join(config.baseDir, 'data', 'sessions.json');

// One durable Claude session per PR. First sight -> mint uuid (--session-id);
// later diffs -> --resume that uuid, so the worker remembers prior rounds.
async function loadSessions() {
  try { return JSON.parse(await readFile(SESSIONS, 'utf8')); } catch { return {}; }
}
// Compute the session for a PR WITHOUT persisting. Persisting before a worker
// actually launches creates a phantom session that --resume can't find, so we
// only commit it via persistSession() once the spawn really happens.
export async function getOrCreateSession(prKey) {
  const map = await loadSessions();
  if (map[prKey]) return { id: map[prKey].id, isNew: false, lastSeenSha: map[prKey].lastSeenSha || null };
  return { id: randomUUID(), isNew: true, lastSeenSha: null };
}

async function persistSession(prKey, id) {
  const map = await loadSessions();
  if (!map[prKey]) { map[prKey] = { id, createdAt: new Date().toISOString() }; await writeFile(SESSIONS, JSON.stringify(map, null, 2)); }
}

// Record the worktree HEAD after a run, so the next resume can `git diff since..HEAD`.
async function recordSeenSha(prKey, worktreePath) {
  try {
    const { stdout } = await exec('git', ['-C', worktreePath, 'rev-parse', 'HEAD']);
    const map = await loadSessions();
    if (map[prKey]) { map[prKey].lastSeenSha = stdout.trim(); await writeFile(SESSIONS, JSON.stringify(map, null, 2)); }
  } catch {}
}

// Read back the last worker run's result JSON for a PR (the file the worker was
// told to write). Null if absent/unparseable. The file is model-written and not
// schema-enforced, so we validate the shape deriveRecord depends on and log any drift
// (bad/renamed fields) loudly — otherwise threads silently fall to the notYetReviewed disposition.
// Malformed individual actions are dropped; the rest of the result still merges.
export async function readWorkerResult(outPath) {
  let raw;
  try { raw = JSON.parse(await readFile(outPath, 'utf8')); } catch { return null; }
  const { result, problems } = validateWorkerResult(raw);
  if (problems.length) console.warn(`[worker-result] ${outPath}: ${problems.join('; ')}`);
  return result;
}

// Dispatch the per-PR worker for only the NEW/changed threads.
// First sight: --session-id <uuid>. Later diffs: --resume <uuid>.
export async function runWorker(pr, newThreads, worktreePath, outPath, opts = {}) {
  const prKey = `${pr.repo}#${pr.number}`;
  const { id, isNew, lastSeenSha } = await getOrCreateSession(prKey);
  opts.lastSeenSha = lastSeenSha;

  const rules = await readFile(new URL('./worker-prompt.md', import.meta.url), 'utf8');
  const pushNote = opts.detached
    ? `\nPush mode: DETACHED HEAD — commit then \`git push origin ${opts.pushRefspec}\`. Do not switch branches.`
    : `\nPush mode: on branch ${pr.headRefName} — commit then \`git push\`.`;

  let head;
  if (isNew) {
    // First run: build durable understanding of the whole PR. This intelligence
    // carries to every future resume, so we never re-send the full diff again.
    const diff = await fetchDiff(pr.nameWithOwner, pr.number);
    const diffBlock = diff?.diff
      ? `\n## Familiarize yourself with this PR FIRST\nThis is the PR diff. Read it and open the changed files in the worktree so you understand what this PR does and which choices are deliberate. You will REMEMBER this for future rounds.\n\`\`\`diff\n${diff.diff}\n\`\`\``
      : diff?.truncated
        ? `\n## Familiarize yourself with this PR FIRST\nChanged files (diff too large to inline — read them in the worktree):\n${diff.files.join('\n')}`
        : '';
    head = [rules, diffBlock];
  } else if (opts.applyApproved) {
    // Apply-approved resume: the user signed off on an approach you proposed on
    // the threads below. This is NOT fresh triage — carry out that approach as a
    // normal fix (pick up your own prior analysis); re-ground on volatile state first.
    const since = opts.lastSeenSha;
    head = [
      'The user APPROVED an approach you previously proposed on the thread(s) below. Carry it out NOW as a normal fix (commit, push, reply `fixed`, resolve) — it is no longer a surface. You already reasoned about these threads; pick up your prior analysis rather than re-deriving it.',
      since
        ? `First run \`git diff ${since}..HEAD\` in the worktree to re-ground on what changed since you last worked it, then re-read just the files for these threads as they are NOW.`
        : `First re-read just the files referenced by these threads, as they are NOW (the branch may have moved).`,
    ];
  } else {
    // Resume: the session already understands the PR. Send only the delta and
    // re-ground on volatile state — the worktree was just `git pull`ed, and
    // `git diff <since>..HEAD` shows what moved since you last looked.
    const since = opts.lastSeenSha;
    head = [
      'New reviewer feedback arrived on this PR. You already understand this PR from earlier rounds — do NOT re-read everything.',
      since
        ? `Run \`git diff ${since}..HEAD\` in the worktree to see ONLY what changed since you last worked it, then re-read just the files touched by the new threads.`
        : `Re-read just the files referenced by the new threads, as they are NOW (the branch may have moved).`,
    ];
  }

  const bh = opts.branchHealth || {};
  // The PR's base branch (from the scan). The worker MUST rebase onto the REMOTE
  // base (origin/<base>), not a local ref — the long-lived clone's local base
  // branch lags origin, so `git rebase main` rebases onto a stale base and misses
  // the real conflict GitHub reports. Default to main only if the scan lacked it.
  const base = pr.baseRefName || 'main';
  const healthBlock = (bh.mergeState || bh.checkState)
    ? `\n## Branch health\nmergeable=${bh.mergeable} mergeState=${bh.mergeState} checks=${bh.checkState}`
      + ((bh.failingChecks || []).length ? `\nfailing checks:\n${bh.failingChecks.map(c => `- ${c.name} [${c.state}] ${c.url || ''}`).join('\n')}` : '')
      + (opts.rebase
        ? `\nREBASE this run: YES — the branch conflicts with its base (${base}). Run \`git fetch origin ${base}\`, then \`git rebase origin/${base}\` — rebase onto the REMOTE base, NOT a local ref (your local ${base} may be stale and would hide the conflict). Resolve conflicts; if it applies cleanly, push with --force-with-lease. If the conflicts are NOT trivial to resolve safely, STOP and surface it (branchHealth.surfaced) — do not guess through a messy merge.`
        : `\nREBASE this run: NO — do not rebase; only fix CI if it's caused by your changes.`)
    : '';
  const threadsHeading = opts.applyApproved
    ? `\n## Approved threads — execute the approach you proposed on each (read each referenced file in the worktree as it is NOW)`
    : `\n## New/changed unresolved threads (read each referenced file in the worktree as it is NOW)`;
  const threadsBlock = newThreads.length
    ? `${threadsHeading}\n${JSON.stringify(newThreads, null, 2)}`
    : `\n## No new review threads this run — you were dispatched for branch health only.`;
  const task = [
    ...head,
    `\n## This task`,
    `PR: ${pr.nameWithOwner}#${pr.number} — ${pr.title}`,
    `Worktree: ${worktreePath}`,
    pushNote.trimStart(),
    `Write your result JSON to: ${outPath}`,
    healthBlock,
    threadsBlock,
  ].join('\n');

  const args = isNew
    ? ['--session-id', id, '-p', task]
    : ['--resume', id, '-p', task];
  args.push('--output-format', 'stream-json', '--verbose');
  // plan mode = enforced read-only (classify/observe trials); bypassPermissions =
  // full autonomy for unattended go-live. Default to the latter.
  args.push('--permission-mode', opts.permissionMode || 'bypassPermissions');
  // Worker model is configurable (config.workerModel): haiku for fast/cheap testing,
  // sonnet for prod. Unset -> the CLI default. Only passed on a NEW session — the
  // model is fixed at session birth; --resume keeps the session's original model.
  if (isNew && config.workerModel) args.push('--model', config.workerModel);

  if (isNew) await persistSession(prKey, id);
  return await new Promise((resolve) => {
    const child = spawn('claude', args, { cwd: worktreePath, env: ghEnv });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('close', async (code) => {
      await recordSeenSha(prKey, worktreePath);
      resolve({ spawned: true, sessionId: id, code, tail: out.slice(-500) });
    });
  });
}

// Short, generic conversation-openers for a branch-health discuss (no thread). The
// resumed session already holds the detailed blocker; these just kick off the chat.
const BRANCH_DISCUSS_OPENERS = {
  rebase: 'Can you help me figure out what to do with this rebase?',
  conflict: 'Can you help me figure out what to do with this rebase?',
  outOfSync: 'The branch is out of sync with the remote — can you help me reconcile it?',
  surfaced: 'You surfaced something on this PR for me — can you walk me through it and what you’d suggest?',
  default: 'Can you help me with the branch issue you flagged on this PR?',
};

// Open an INTERACTIVE Claude in a native Terminal — for a disputed review thread
// (thread given) or a branch-health/rebase conflict the agent surfaced (no thread).
// The seed prompt is free-form prose (apostrophes, quotes, slashes, newlines), so
// we do NOT interpolate it into the AppleScript/shell string — that breaks osascript
// (silent syntax errors). Instead we write the seed and a tiny launcher script to
// temp files and have AppleScript run the launcher; the only value crossing into
// AppleScript is a safe temp path.
export async function spawnDiscussTerminal(pr, thread, worktreePath, branchKind = null) {
  // A seed is only useful when it tells the session something it doesn't already
  // know. For a review THREAD it disambiguates which of (possibly many) threads you
  // clicked. For branch-health (no thread) we inject only a SHORT, generic opener
  // keyed by what you clicked on — not the detailed blocker text, which the resumed
  // session already holds (so it can't go stale). It's a conversation starter, not
  // a re-statement of the problem.
  let seed = null;
  if (thread) {
    const quote = (thread.body || '').slice(0, 400);
    // Neutral pointer, not a verdict: the thread was surfaced for judgment, which
    // could be a disagreement, a scope/product call, or something the worker
    // couldn't classify. Point the resumed session at the right thread and let it
    // recall its own take rather than pre-framing it as a "disagreement".
    seed = `Let's think through the surfaced thread on ${pr.nameWithOwner}#${pr.number}, `
      + `file ${thread.path}:${thread.line}. ${thread.author} said: "${quote}". `
      + `Remind me why you surfaced it and what you'd suggest; if we land on a reply, post it.`;
  } else if (branchKind) {
    seed = BRANCH_DISCUSS_OPENERS[branchKind] || BRANCH_DISCUSS_OPENERS.default;
  }

  // Continue the PR's DURABLE session so the interactive terminal picks up the
  // headless worker's prior analysis (--resume), instead of a cold Claude. Fall back
  // to a fresh `claude` if no session exists yet (the PR was never worked).
  const prKey = `${pr.repo}#${pr.number}`;
  const { id, isNew } = await getOrCreateSession(prKey);
  const claudeCmd = isNew ? 'claude' : `claude --resume ${id}`;

  const tmp = tmpdir();
  const tag = `pr-controller-discuss-${pr.repo}-${pr.number}-${randomUUID().slice(0, 8)}`;
  const seedFile = join(tmp, `${tag}.txt`);
  const launchFile = join(tmp, `${tag}.sh`);
  // Launcher: with a seed, pass it as the opening prompt via a file (no quoting of
  // prose anywhere); without one, just open the (resumed) session for free input.
  // Either way it self-removes its temp files once Claude exits.
  const rmTargets = (seed ? `${JSON.stringify(seedFile)} ` : '') + JSON.stringify(launchFile);
  const claudeLine = seed ? `${claudeCmd} "$(cat ${JSON.stringify(seedFile)})"` : claudeCmd;
  const launcher = `#!/bin/bash\ncd ${JSON.stringify(worktreePath)}\n${claudeLine}\nrm -f ${rmTargets}\n`;
  try {
    if (seed) await writeFile(seedFile, seed);
    await writeFile(launchFile, launcher);
    // The launch path is our own safe slug, so this AppleScript string is stable.
    const osa = `tell application "Terminal" to do script "bash ${launchFile}"`;
    const child = spawn('osascript', ['-e', osa]);
    let err = '';
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => {
      if (code !== 0) console.error(`[discuss] ${prKey}: osascript exited ${code}: ${err.trim()}`);
    });
  } catch (e) {
    console.error(`[discuss] ${prKey}: failed to stage terminal launch:`, e.message);
    return { spawned: false, reason: 'could not stage terminal launch' };
  }
  return { spawned: true, resumed: !isNew };
}
