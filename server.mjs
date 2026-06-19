import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { config, ghEnv } from './config.mjs';

import { scanAll, scanOnePr } from './scanner.mjs';
import { spawnDiscussTerminal, runWorker, readWorkerResult } from './worker.mjs';
import { ensureWorktree } from './worktree.mjs';
import { dispatchable, needsJira, isBehindBase, needsRebase, deriveTier, dispatchDecision, nextSeenThreads } from './rules.mjs';
import * as events from './events.mjs';
import * as dispatcher from './dispatcher.mjs';

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
// prKeys whose worktree could not fast-forward on the last dispatch (the branch
// diverged from the remote — force-push/rebase). The dispatcher reports this via
// markOutOfSync(); it's set on a ff-only failure and cleared on a clean sync. We
// track it here (not on the scanned PR object, which is rebuilt from GitHub and
// has no worktree knowledge) so it survives refreshOnePR into the dashboard.
const outOfSyncPRs = new Set();
// Guard so the interval timer and a manual /poll can't run poll() concurrently.
let polling = false;

const TIER_RANK = { needsYourApproval: 0, agentError: 1, agentAutoFixed: 2, notYetReviewed: 3, awaitingReviewer: 4, agentAcknowledged: 5 };

const fp = (t) => `${t.threadId}:${t.lastCommentId}`;
const outPathFor = (pr) => join(DATA, `worker-${pr.repo}-${pr.number}.json`);

// Read back the last worker run's verdict for this PR and derive every dashboard
// field from it: per-thread tiers, the surfaced branch-health reason, and the
// PR-level needsYou/autoFixable/pending/priority. Mutates `pr` in place. Shared
// by poll() and refreshOnePR() so a freshly-polled PR and one refreshed right
// after a worker run go through identical derivation. Also carries the worker's
// suggestedReply/suggestedApproach onto each thread for the UI.
async function deriveAndSetPrFields(pr) {
  const h = pr.branchHealth || {};
  pr.behindBase = isBehindBase(h.mergeState, h.mergeable);
  pr.ciFailing = (h.failingChecks || []).length > 0;  // code CI only
  pr.needsRebase = needsRebase(h.mergeState, h.mergeable);  // genuine merge conflict
  // Compliance failing + no JIRA key in title => surface an input box for the ticket.
  pr.needsJira = needsJira(pr.title, h.complianceChecks);

  // Derive each thread's tier from the WORKER's verdict (its code-grounded
  // response), not a keyword heuristic. The worker resolves threads it
  // fixed/praised, so those are already gone from the scan; what's left is
  // either surfaced (hash-out, needs you), waiting on the reviewer, or not
  // yet judged (pending — "No feedback yet"). Match worker actions by threadId.
  const result = await readWorkerResult(outPathFor(pr));
  const actions = new Map((result?.actions || []).map((a) => [a.threadId, a]));
  pr.threads = pr.threads.map((t) => {
    const a = actions.get(t.threadId);
    return { ...t, ...deriveTier(t, a), suggestedReply: a?.suggestedReply, suggestedApproach: a?.suggestedApproach };
  });

  // A surfaced branch-health reason means the worker TRIED and bailed (e.g. a
  // rebase whose conflicts weren't trivially resolvable). That's now yours to
  // resolve, so it escalates to needsYou. (Previously rebase was approval-gated
  // and this waited on the reviewer; with rebase user-initiated, a bail is on you.)
  const surfaced = result?.branchHealth?.surfaced;
  if (surfaced) pr.workerSurfaced = surfaced;

  // The branch diverged from the remote and the worktree couldn't fast-forward,
  // so the last dispatch bailed without running. Read from the durable set (the
  // dispatcher sets it; a clean sync clears it) — it can't live on the scanned
  // PR object, which is rebuilt from GitHub each refresh.
  pr.outOfSync = outOfSyncPRs.has(`${pr.repo}#${pr.number}`);

  // PR-level fields derived from the per-thread tiers + branch state.
  pr.needsYou = pr.threads.some((t) => t.tier === 'needsYourApproval') || pr.needsJira || !!pr.outOfSync || !!surfaced;
  pr.autoFixable = pr.threads.filter((t) => t.tier === 'agentAutoFixed').length;
  pr.pending = pr.threads.filter((t) => t.tier === 'notYetReviewed').length;
  pr.priority = Math.min(...pr.threads.map((t) => TIER_RANK[t.tier] ?? 9), 9);
}

async function writeState(prs) {
  prs.sort((a, b) => a.priority - b.priority || (b.needsYou - a.needsYou));
  state = { updatedAt: new Date().toISOString(), scope: config.onlyPRs || [], prs };
  await mkdir(DATA, { recursive: true });
  await writeFile(STATE, JSON.stringify(state, null, 2));
}

// Re-scan ONE PR after its worker finished, re-derive its fields, patch it into
// the live state, persist, and nudge clients to re-fetch. Called by the
// dispatcher on every worker exit (the worker may have resolved/replied/pushed).
async function refreshOnePR(prKey) {
  const pr = await scanOnePr(prKey);
  if (!pr) {  // no longer open / in scope — drop it from state
    const prs = state.prs.filter((p) => `${p.repo}#${p.number}` !== prKey);
    if (prs.length !== state.prs.length) { await writeState(prs); events.notifyStateUpdated(); }
    return;
  }
  await deriveAndSetPrFields(pr);
  const prs = state.prs.filter((p) => `${p.repo}#${p.number}` !== prKey);
  prs.push(pr);
  await writeState(prs);
  events.notifyStateUpdated();
}

// Wire the dispatcher's injected dependencies once at module load. markOutOfSync
// lets the dispatcher report whether the worktree could fast-forward, so the
// diverged-branch state survives into the dashboard (see outOfSyncPRs).
dispatcher.init({
  events, ensureWorktree, runWorker, refreshOnePR, outPath: outPathFor,
  markOutOfSync: (prKey, v) => { if (v) outOfSyncPRs.add(prKey); else outOfSyncPRs.delete(prKey); },
});

async function poll() {
  if (polling) { console.log('[poll] already running, skipped'); return; }
  polling = true;
  try {
    const prs = await scanAll();
    for (const pr of prs) {
      // Derive fields from the EXISTING worker result (the new dispatch below
      // runs out-of-band and refreshes this PR when it finishes).
      await deriveAndSetPrFields(pr);

      // Diff vs last poll: new threads, and whether branch health changed.
      const prKey = `${pr.repo}#${pr.number}`;
      const h = pr.branchHealth || {};
      const prev = seen.get(prKey) || { threads: new Set(), health: '' };
      const newThreads = pr.threads.filter((t) => !t.error && !prev.threads.has(fp(t)) && dispatchable(t));
      const healthSig = `${h.mergeable}|${h.mergeState}|${h.checkState}|${(h.failingChecks||[]).map(c=>c.name+c.state).join(',')}`;
      const healthChanged = healthSig !== prev.health;

      // What to dispatch is a pure decision (rules.dispatchDecision, tested): a real
      // merge conflict short-circuits to a rebase-ONLY run; otherwise threads/CI.
      const decision = dispatchDecision({
        newThreadCount: newThreads.length, ciFailing: pr.ciFailing,
        needsRebase: pr.needsRebase, healthChanged,
      });

      // Mark threads seen — but DEFER while a real conflict blocks the PR (a conflict
      // run is rebase-only, so consuming threads now would strand them un-judged).
      // nextSeenThreads (pure, tested) encodes the rule. Always advance the health sig.
      const liveFps = pr.threads.filter((t) => !t.error).map(fp);
      seen.set(prKey, { threads: nextSeenThreads(prev.threads, liveFps, pr.needsRebase), health: healthSig });

      if (decision.kind === 'feedback')
        dispatcher.enqueue(pr, newThreads, { branchHealth: pr.branchHealth });
      else if (decision.kind === 'rebase')
        dispatcher.enqueueRebase(pr, { branchHealth: pr.branchHealth });
    }
    await writeState(prs);
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
  // Live status channel. Pushes worker-started/worker-finished (the in-flight
  // prKey set) and a state-updated nudge so the UI reflects worker activity
  // instantly instead of on the 60s client poll. state.json stays the snapshot.
  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    events.addSubscriber(req, res);
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
        // threadId present -> discuss a review thread; absent -> branch-health
        // (rebase) discussion, where there is no thread (thread stays undefined).
        const thread = payload.threadId ? pr?.threads.find((t) => t.threadId === payload.threadId) : undefined;
        if (!pr || (payload.threadId && !thread)) spawn = { spawned: false, reason: 'PR or thread not found' };
        else {
          const wt = await ensureWorktree(pr);
          // For a branch-health (no-thread) discuss, payload.kind names what was
          // clicked (rebase/conflict/outOfSync/surfaced) so the terminal opens with
          // a short generic opener about that thing.
          spawn = await spawnDiscussTerminal(pr, thread, wt.path, thread ? null : payload.kind);
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
        else {
          await setPrJira(pr, ticket);
          // Re-scan so state.json reflects the new title and recomputes needsJira
          // (now false — the title has a key). Without this, a reload refetches the
          // stale state and the input box reappears until the next 30-min poll.
          await refreshOnePR(payload.prKey);
          spawn = { spawned: true, action: 'title updated' };
        }
      }
      // Phase 2: the user approved one or more proposed approaches. Stage them
      // into the dispatcher's pending set for this PR; it fires ONE resumed
      // worker (or queues for the next free slot if a worker is already running
      // for this PR — the coalescing lock guarantees no double-dispatch).
      if (payload.action === 'run-agent') {
        const pr = state.prs.find((p) => `${p.repo}#${p.number}` === payload.prKey);
        const threadIds = Array.isArray(payload.threadIds) ? payload.threadIds : [];
        if (!pr) spawn = { spawned: false, reason: 'PR not found' };
        else if (!threadIds.length) spawn = { spawned: false, reason: 'no approved threads' };
        else {
          const queued = dispatcher.isWorking(payload.prKey);
          dispatcher.enqueueApproved(pr, threadIds, { branchHealth: pr.branchHealth, rebaseOnConflict: pr.needsRebase });
          spawn = { spawned: true, queued, action: queued ? 'queued for next run' : 'agent dispatched' };
        }
      }
      // Manual "Rebase" CTA: the branch has a merge conflict and there's nothing
      // else queued for the worker to do, so we didn't auto-dispatch (a quiet
      // force-push would dismiss reviews). The user opted in — dispatch a rebase.
      if (payload.action === 'rebase') {
        const pr = state.prs.find((p) => `${p.repo}#${p.number}` === payload.prKey);
        if (!pr) spawn = { spawned: false, reason: 'PR not found' };
        else if (!pr.needsRebase) spawn = { spawned: false, reason: 'no merge conflict to rebase' };
        else {
          const queued = dispatcher.isWorking(payload.prKey);
          dispatcher.enqueueRebase(pr, { branchHealth: pr.branchHealth });
          spawn = { spawned: true, queued, action: queued ? 'queued for next run' : 'rebase dispatched' };
        }
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
