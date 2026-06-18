import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { config, ghEnv } from './config.mjs';

const exec = promisify(execFile);
// Prepend "[TICKET]" to the PR title to satisfy the compliance check.
async function setPrJira(pr, ticket) {
  const newTitle = `[${ticket}] ${pr.title}`;
  await exec('gh', ['pr', 'edit', String(pr.number), '--repo', pr.nameWithOwner, '--title', newTitle], { env: ghEnv });
}

// Post the user's rebuttal as a reply on a specific review thread (threadId is
// the GraphQL node id from the scanner).
const REPLY_MUTATION = `mutation($threadId:ID!, $body:String!) {
  addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$threadId, body:$body}) {
    comment { id }
  }
}`;
async function postThreadReply(threadId, body) {
  await exec('gh', ['api', 'graphql', '-f', `query=${REPLY_MUTATION}`,
    '-F', `threadId=${threadId}`, '-F', `body=${body}`], { env: ghEnv });
}
import { scanAll } from './scanner.mjs';
import { spawnDiscussTerminal, runWorker, readWorkerResult } from './worker.mjs';
import { ensureWorktree } from './worktree.mjs';
import { dispatchable, needsJira, rebaseAllowed, deriveTier } from './rules.mjs';

const DATA = join(config.baseDir, 'data');
const STATE = join(DATA, 'state.json');
const DECISIONS = join(DATA, 'decisions.json');

// Serve the built React dashboard from pr-controller-react/dist when present;
// fall back to the legacy single-file dashboard.html otherwise.
const DIST = join(config.baseDir, 'pr-controller-react', 'dist');
const hasDist = existsSync(join(DIST, 'index.html'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2',
  '.png': 'image/png', '.ico': 'image/x-icon' };

let state = { updatedAt: null, scope: config.onlyPRs || [], prs: [] };
// prKey -> Set of "threadId:lastCommentId" seen last poll, for diff detection.
const seen = new Map();
// Guard so the interval timer and a manual /poll can't run poll() concurrently.
let polling = false;

const TIER_RANK = { 'hash-out': 0, error: 1, 'agree-fix': 2, pending: 3, 'waiting-reviewer': 4 };

const fp = (t) => `${t.threadId}:${t.lastCommentId}`;

async function poll() {
  if (polling) { console.log('[poll] already running, skipped'); return; }
  polling = true;
  try {
    const prs = await scanAll();
    for (const pr of prs) {
      // Branch-health flags (separate trigger from review threads).
      const h = pr.branchHealth || {};
      pr.behindBase = rebaseAllowed(pr.reviewDecision, h.mergeState, h.mergeable);
      pr.ciFailing = (h.failingChecks || []).length > 0;  // code CI only

      // Compliance failing + no JIRA key in title => surface an input box for the ticket.
      pr.needsJira = needsJira(pr.title, h.complianceChecks);

      // Diff vs last poll: new threads, and whether branch health changed.
      const prKey = `${pr.repo}#${pr.number}`;
      const outPath = join(DATA, `worker-${pr.repo}-${pr.number}.json`);
      const prev = seen.get(prKey) || { threads: new Set(), health: '' };
      const newThreads = pr.threads.filter((t) => !t.error && !prev.threads.has(fp(t)) && dispatchable(t));
      const healthSig = `${h.mergeable}|${h.mergeState}|${h.checkState}|${(h.failingChecks||[]).map(c=>c.name+c.state).join(',')}`;
      const healthChanged = healthSig !== prev.health;
      seen.set(prKey, { threads: new Set(pr.threads.filter((t) => !t.error).map(fp)), health: healthSig });

      // Dispatch when feedback changed OR the branch needs work (behind/conflicted/CI).
      // The worker attempts the rebase/CI fix and surfaces if it's too hairy.
      const healthWork = pr.behindBase || pr.ciFailing;
      if (newThreads.length || (healthChanged && healthWork)) {
        const wt = await ensureWorktree(pr);
        if (wt.outOfSync) {
          pr.outOfSync = true;  // escalates to needsYou when PR-level fields are computed below
          console.log(`[dispatch] ${prKey}: branch out of sync, surfacing instead of launching`);
        } else {
          const r = await runWorker(pr, newThreads, wt.path, outPath,
            { detached: wt.detached, pushRefspec: wt.pushRefspec, branchHealth: pr.branchHealth, rebaseAllowed: pr.behindBase });
          console.log(`[dispatch] ${prKey}: ${newThreads.length} thread(s)${healthWork?' +health':''} ->`, r.spawned ? `session ${r.sessionId} (exit ${r.code})` : r.reason, wt.plan || '');
          // Surface what the headless worker actually did: its stdout tail, and
          // whether it wrote the result JSON it was told to. A missing file after
          // a "spawned" run = the worker errored/no-op'd (e.g. phantom --resume).
          if (r.spawned) {
            if (r.tail) console.log(`[worker ${prKey}] tail:`, r.tail.trim());
            if (!existsSync(outPath)) console.warn(`[worker ${prKey}] WARN: no result JSON at ${outPath} — worker took no action (errored or empty run)`);
          }
        }
      }

      // Derive each thread's tier from the WORKER's verdict (its code-grounded
      // response), not a keyword heuristic. The worker resolves threads it
      // fixed/praised, so those are already gone from the scan; what's left is
      // either surfaced (hash-out, needs you), waiting on the reviewer, or not
      // yet judged (pending — "No feedback yet"). Match worker actions by threadId.
      const result = await readWorkerResult(outPath);
      const actions = new Map((result?.actions || []).map((a) => [a.threadId, a]));
      pr.threads = pr.threads.map((t) => ({ ...t, ...deriveTier(t, actions.get(t.threadId)) }));

      // A surfaced branch-health reason (e.g. a rebase the worker wasn't allowed
      // to do until approval) is the reviewer's move next, not yours — carry it
      // for context but don't escalate (see adapt.js bucketing).
      const surfaced = result?.branchHealth?.surfaced;
      if (surfaced) pr.workerSurfaced = surfaced;

      // PR-level fields derived from the per-thread tiers + branch state.
      pr.needsYou = pr.threads.some((t) => t.tier === 'hash-out') || pr.needsJira || !!pr.outOfSync;
      pr.autoFixable = pr.threads.filter((t) => t.tier === 'agree-fix').length;
      pr.pending = pr.threads.filter((t) => t.tier === 'pending').length;
      pr.priority = Math.min(...pr.threads.map((t) => TIER_RANK[t.tier] ?? 9), 9);
    }
    prs.sort((a, b) => a.priority - b.priority || (b.needsYou - a.needsYou));
    state = { updatedAt: new Date().toISOString(), scope: config.onlyPRs || [], prs };
    await mkdir(DATA, { recursive: true });
    await writeFile(STATE, JSON.stringify(state, null, 2));
    console.log(`[poll] ${prs.length} PRs, ${prs.filter(p=>p.needsYou).length} need you`);
  } catch (e) {
    console.error('[poll] failed:', e.message);
  } finally {
    polling = false;
  }
}

async function recordDecision(payload) {
  let all = [];
  try { all = JSON.parse(await readFile(DECISIONS, 'utf8')); } catch {}
  all.push({ ...payload, at: new Date().toISOString() });
  await writeFile(DECISIONS, JSON.stringify(all, null, 2));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${config.port}`);
  if (req.method === 'GET' && url.pathname === '/') {
    if (hasDist) {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(await readFile(join(DIST, 'index.html')));
    } else {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(await readFile(join(config.baseDir, 'dashboard.html')));
    }
    return;
  }
  // Static assets from the React build (e.g. /assets/index-*.js, fonts).
  if (req.method === 'GET' && hasDist && url.pathname.startsWith('/assets/')) {
    const file = join(DIST, url.pathname);
    if (existsSync(file)) {
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(await readFile(file));
      return;
    }
  }
  if (req.method === 'GET' && url.pathname === '/state.json') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(state));
    return;
  }
  // TEMP (debug): kick off a poll on demand instead of waiting the 30-min timer.
  // Fire-and-forget — poll() can take minutes when it dispatches workers, so we
  // don't await it; the client re-fetches /state.json to see the result.
  if (req.method === 'POST' && url.pathname === '/poll') {
    const started = !polling;
    if (started) poll();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, started, reason: started ? 'poll started' : 'poll already running' }));
    return;
  }
  if (req.method === 'POST' && url.pathname === '/decision') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      const payload = JSON.parse(body || '{}');
      await recordDecision(payload);
      let spawn = { spawned: false, reason: `unknown action: ${payload.action}` };
      if (payload.action === 'discuss') {
        const pr = state.prs.find((p) => `${p.repo}#${p.number}` === payload.prKey);
        const thread = pr?.threads.find((t) => t.threadId === payload.threadId);
        if (!pr || !thread) spawn = { spawned: false, reason: 'PR or thread not found' };
        else {
          const wt = await ensureWorktree(pr);
          spawn = spawnDiscussTerminal(pr, thread, wt.path);
        }
      }
      if (payload.action === 'note') {
        const pr = state.prs.find((p) => `${p.repo}#${p.number}` === payload.prKey);
        const thread = pr?.threads.find((t) => t.threadId === payload.threadId);
        const body = (payload.note || '').trim();
        if (!pr || !thread) spawn = { spawned: false, reason: 'PR or thread not found' };
        else if (!body) spawn = { spawned: false, reason: 'empty rebuttal' };
        else { await postThreadReply(thread.threadId, body); spawn = { spawned: true, action: 'reply posted' }; }
      }
      if (payload.action === 'set-jira') {
        const pr = state.prs.find((p) => `${p.repo}#${p.number}` === payload.prKey);
        const ticket = (payload.ticket || '').trim();
        const valid = new RegExp(`^${config.jiraPattern}$`).test(ticket);
        if (!valid) spawn = { spawned: false, reason: `"${ticket}" is not a JIRA key like ABC-123` };
        else { await setPrJira(pr, ticket); spawn = { spawned: true, action: 'title updated' }; }
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, scope: config.onlyPRs || [], spawn }));
    });
    return;
  }
  res.writeHead(404); res.end('not found');
});

server.listen(config.port, async () => {
  const scope = (config.onlyPRs || []).length ? `scoped to ${config.onlyPRs.join(', ')}` : 'all open PRs';
  console.log(`PR dashboard on http://localhost:${config.port}  (${scope})`);
  await poll();
  setInterval(poll, config.pollMinutes * 60 * 1000);
});
