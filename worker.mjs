// Worker dispatch: spawns a headless `claude -p` scoped to ONE PR. Scope is
// enforced upstream by `config.onlyPRs` (the poller only ever hands us in-scope PRs).
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { config, ghEnv } from './config.mjs';
import { fetchDiff } from './scanner.mjs';

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
// told to write). Null if absent/unparseable. Lets the poller reflect what the
// worker actually decided — surfaced branch-health, per-thread responses.
export async function readWorkerResult(outPath) {
  try { return JSON.parse(await readFile(outPath, 'utf8')); } catch { return null; }
}

// Cheap heuristic pre-classification (no Claude). Used to render the dashboard
// before/without a worker, and to decide priority. The real judgment is the
// worker's job. (Scaffolding — slated for retirement once worker output is
// plumbed into state.json; see the suggested-responses plan.)
const RISKY = [/security/i, /xss/i, /inject/i, /\brefactor\b/i, /antipattern/i,
  /should we/i, /do we (want|need)/i, /curious if/i, /\bzod\b/i, /schema/i];

export function preClassify(thread) {
  if (thread.error) return { tier: 'error', reason: thread.error };
  // If WE replied last, it's waiting on the reviewer, not us.
  if (thread.lastAuthor === config.login)
    return { tier: 'waiting-reviewer', reason: 'you replied last' };
  const text = thread.body || '';
  const looksRisky = RISKY.some((re) => re.test(text));
  const isQuestion = /\?\s*$/.test(text.trim()) || /^(is|are|do|does|can|should|why|what|how)\b/i.test(text.trim());
  if (looksRisky || isQuestion)
    return { tier: 'hash-out', reason: looksRisky ? 'risk/scope keyword' : 'reviewer asked a question' };
  return { tier: 'agree-fix', reason: 'looks low-consequence' };
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
  const healthBlock = (bh.mergeState || bh.checkState)
    ? `\n## Branch health\nmergeable=${bh.mergeable} mergeState=${bh.mergeState} checks=${bh.checkState}`
      + ((bh.failingChecks || []).length ? `\nfailing checks:\n${bh.failingChecks.map(c => `- ${c.name} [${c.state}] ${c.url || ''}`).join('\n')}` : '')
      + `\nRebase allowed this run: ${opts.rebaseAllowed ? 'YES (PR is approved)' : 'NO — do NOT rebase (PR not yet approved); only fix CI if related to your changes'}`
    : '';
  const threadsBlock = newThreads.length
    ? `\n## New/changed unresolved threads (read each referenced file in the worktree as it is NOW)\n${JSON.stringify(newThreads, null, 2)}`
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

// Open an INTERACTIVE Claude in a native Terminal scoped to one disputed thread.
export function spawnDiscussTerminal(pr, thread, worktreePath) {
  const quote = (thread.body || '').replace(/"/g, '\\"').slice(0, 400);
  const seed = `Let's discuss reviewer feedback on ${pr.nameWithOwner}#${pr.number}, `
    + `file ${thread.path}:${thread.line}. Reviewer ${thread.author} said: "${quote}". `
    + `It was flagged as a disagreement. Help me decide and, if we agree on a reply, post it.`;
  const script = `cd ${worktreePath} && claude "${seed.replace(/"/g, '\\"')}"`;
  const osa = `tell application "Terminal" to do script "${script.replace(/"/g, '\\"')}"`;
  spawn('osascript', ['-e', osa]);
  return { spawned: true };
}
