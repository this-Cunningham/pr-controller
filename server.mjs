import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { config, ghEnv, hasLocalConfig, cloneRootDefaulted, clampPoll } from './config.mjs';
import { DATA, STATE, DECISIONS, workerFileFor } from './paths.mjs';

import { scanAll, scanOnePr } from './scanner.mjs';
import { spawnDiscussTerminal, runWorker, readWorkerResult, drainWorkers, wasInterrupted } from './worker.mjs';
import { ensureWorktree } from './worktree.mjs';
import { cleanupPr } from './cleanup.mjs';
import { dispatchable, dispatchDecision, nextSeenThreads, isWorkerResultStale, isBranchHealthResultStale } from './rules.mjs';
import { deriveRecord } from './derive.mjs';
import { placementsFor, prSortRank, LANES } from './placements.mjs';
import * as events from './events.mjs';
import * as dispatcher from './dispatcher.mjs';
import { SENSITIVITY_LEVELS, clampSensitivity } from './sensitivity.mjs';
import { logger } from './log.mjs';

const exec = promisify(execFile);
const log = logger('poll');
const httpLog = logger('http');

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

// Serve the built React dashboard from pr-controller-react/dist. The React app is
// the canonical client — build it (`yarn build`) before running in production.
const DIST = join(config.baseDir, 'pr-controller-react', 'dist');
const hasDist = existsSync(join(DIST, 'index.html'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2',
  '.png': 'image/png', '.ico': 'image/x-icon' };

let state = { updatedAt: null, scope: config.onlyPRs || [], prs: [], pollingEnabled: false };
// prKey -> Set of "threadId:lastCommentId" seen last poll, for diff detection.
const seen = new Map();
// prKeys whose worktree could not fast-forward on the last dispatch (the branch
// diverged from the remote — force-push/rebase). The dispatcher reports this via
// markOutOfSync(); it's set on a ff-only failure and cleared on a clean sync. We
// track it here (not on the scanned PR object, which is rebuilt from GitHub and
// has no worktree knowledge) so it survives refreshOnePR into the dashboard.
const outOfSyncPRs = new Set();
// prKey -> short reason for a FAILED worker run (commonly a git transport/clone/push error).
// Like outOfSyncPRs, it lives here (not on the GitHub-rebuilt PR object) so a worker failure
// survives refreshOnePR onto the dashboard instead of vanishing into the daemon log. Set by the
// dispatcher via markAgentError() on a thrown run; cleared on a clean run or when the PR is gone.
const agentErrorPRs = new Map();
// Most recent failed poll, surfaced into state.json so a scan outage is VISIBLE (the
// dashboard can show "scan failing") instead of silently looking like "no PRs". Set in
// poll()'s catch, cleared on a successful scan. { at: ISO, message } | null.
let lastPollError = null;
// Guard so the interval timer and a manual /poll can't run poll() concurrently.
let polling = false;
// Server-authoritative arm switch. The daemon does NOT poll/dispatch until a human
// turns this on from the dashboard; it ALWAYS starts false (never persisted) so a
// restart can't silently resume acting on PRs. `pollTimer` holds the setInterval
// handle so stopPolling() can clear it. See startPolling()/stopPolling().
let pollingEnabled = false;
let pollTimer = null;
// The gh-authenticated account (`gh api user`), resolved once at startup. PR discovery is
// `--author @me` = this account (NOT config.login), so we surface it in state.json + logs as
// scan provenance — an empty board reads very differently once you can see WHO was scanned.
let account = null;

const fp = (t) => `${t.threadId}:${t.lastCommentId}`;
const outPathFor = (pr) => workerFileFor(pr.repo, pr.number);

// Read back the last worker run's verdict for this PR and derive every dashboard
// field from it: per-thread dispositions, branch-health flags, and the surfaced
// reason. Mutates `pr` in place. Shared by poll() and refreshOnePR() so a freshly-
// polled PR and one refreshed right after a worker run go through identical
// derivation. Tab routing + ordering are computed from these in writeState via the
// placement model (placements.mjs); per-PR ordering is a single sortRank. Also carries
// the worker's suggestedReply/suggestedApproach onto each thread.
async function deriveAndSetPrFields(pr) {
  // Read the last worker run's verdict (model-written; validated) and build the
  // canonical record. deriveRecord is pure + tested (test/derive.test.mjs); this
  // wrapper supplies the two I/O-backed inputs (the verdict file + the durable
  // diverged-branch flag). Shared by poll() and refreshOnePR() so both derive identically.
  const { result, parseError } = await readWorkerResult(outPathFor(pr));
  const prKey = `${pr.repo}#${pr.number}`;
  // An unparseable verdict file surfaces as a Needs-you agentError (-> pr.workerError ->
  // workerFailed) — same plumbing as a dispatcher-reported run failure — so the lost verdict
  // is visible instead of leaving the threads stuck in notYetReviewed ("still reviewing").
  const agentError = agentErrorPRs.get(prKey) || parseError || null;
  deriveRecord(pr, { workerResult: result, outOfSync: outOfSyncPRs.has(prKey), agentError });

  // Invalidate a stale worker verdict file: once none of its actions match a live
  // (unresolved) thread and the branch is clean, the file is stale — unlink it so a
  // later poll starts clean instead of re-asserting a fix on a resolved thread.
  // (Fixes the TODO "PR still shows in auto-handling after fix + resolve" bug.)
  const liveThreadIds = new Set(pr.threads.filter((t) => !t.error && t.threadId).map((t) => t.threadId));
  if (isWorkerResultStale(result, liveThreadIds, { needsRebase: pr.needsRebase, outOfSync: pr.outOfSync })
      || isBranchHealthResultStale(result, { needsRebase: pr.needsRebase, checkState: pr.branchHealth?.checkState }, liveThreadIds)) {
    try { await unlink(outPathFor(pr)); } catch {}
  }
}

// The config the Settings panel renders (server-authoritative): the editable fields it
// writes back via POST /config, plus read-only context it displays. Shipped in state.json
// so the React app just renders + POSTs — it derives no config. NO secrets: only the
// non-secret trigger PHRASES and check categorization, never auth tokens.
function buildSettings() {
  return {
    // editable (POST /config)
    onlyPRs: config.onlyPRs || [],
    pollMinutes: config.pollMinutes,
    workerModel: config.workerModel,
    workerSensitivity: config.workerSensitivity,
    // display-only context
    account,
    login: config.login,
    host: config.host,
    triggerToken: config.triggerToken,
    debugToken: config.debugToken,
    complianceChecks: config.complianceChecks,
    ignoreChecks: config.ignoreChecks,
  };
}

async function writeState(prs) {
  // Server-authoritative tab routing: the daemon owns which lane each item of a PR
  // belongs to and ships a flat list of (prKey, lane, subject) rows — a PR in
  // several tabs is several rows. `placementsFor` is pure + tested
  // (test/placements.test.mjs). liveStatus is intentionally NOT folded in here:
  // it's ephemeral and pushed over SSE, so the client overlays "agent working" from
  // the in-flight set. sortRank (the most-urgent placement) is the only ordering signal.
  const placements = [];
  for (const pr of prs) {
    const rows = placementsFor(pr);
    pr.sortRank = prSortRank(rows);
    for (const r of rows) placements.push(r);
  }
  prs.sort((a, b) => a.sortRank - b.sortRank);
  state = {
    updatedAt: new Date().toISOString(),
    scope: config.onlyPRs || [],
    account,         // the gh-authed account PR discovery ran as (@me) — scan provenance for the UI
    lanes: LANES,
    prs,
    placements,
    lastPollError,   // null when the last scan succeeded; { at, message } on failure
    pollingEnabled,  // the arm switch — the dashboard renders/flips it (off until a human turns it on)
    settings: buildSettings(),       // editable + display config for the Settings panel
    sensitivityLevels: SENSITIVITY_LEVELS,  // static; the Worker-sensitivity slider renders these
  };
  await mkdir(DATA, { recursive: true });
  await writeFile(STATE, JSON.stringify(state, null, 2));
}

// Re-scan ONE PR after its worker finished, re-derive its fields, patch it into
// the live state, persist, and nudge clients to re-fetch. Called by the
// dispatcher on every worker exit (the worker may have resolved/replied/pushed).
async function refreshOnePR(prKey) {
  const pr = await scanOnePr(prKey);
  if (!pr) {  // no longer open / in scope (merged/closed) — drop it + reclaim its leftovers
    // Grab the outgoing PR's true nameWithOwner BEFORE we filter it out, so cleanup
    // can resolve the right (possibly cross-org) clone for its worktree.
    const old = state.prs.find((p) => `${p.repo}#${p.number}` === prKey);
    const prs = state.prs.filter((p) => `${p.repo}#${p.number}` !== prKey);
    if (prs.length !== state.prs.length) { await writeState(prs); events.notifyStateUpdated(); }
    // Clean up the managed worktree, worker verdict file, and session entry. Robust:
    // a cleanup failure must not break the refresh. Also forget our per-poll tracking
    // and the dispatcher's per-PR entry.
    try { await cleanupPr(prKey, old?.nameWithOwner); } catch (e) { log.error(`refreshOnePR cleanup ${prKey} failed`, e.message); }
    seen.delete(prKey); outOfSyncPRs.delete(prKey); agentErrorPRs.delete(prKey); dispatcher.forget(prKey);
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
  markAgentError: (prKey, reason) => { if (reason) agentErrorPRs.set(prKey, reason); else agentErrorPRs.delete(prKey); },
  isInterrupted: wasInterrupted,
});

async function poll() {
  if (polling) { log.info('already running, skipped'); return; }
  polling = true;
  try {
    // Capture the PREVIOUS state's PRs (keyed) BEFORE writeState below reassigns
    // `state`, so we can detect which PRs vanished (merged/closed) this poll and reclaim
    // their leftovers (worktree/worker-file/session). We keep the whole PR object so
    // cleanup gets its true (cross-org) nameWithOwner. See cleanup loop after writeState.
    const prevByKey = new Map(state.prs.map((p) => [`${p.repo}#${p.number}`, p]));
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
        needsRebase: pr.needsRebase, healthChanged, rebaseSurfaced: !!pr.workerSurfaced,
        ciReran: !!pr.ciReran,
      });

      // Mark threads seen — but DEFER while a real conflict blocks the PR (a conflict
      // run is rebase-only, so consuming threads now would strand them un-judged).
      // nextSeenThreads (pure, tested) encodes the rule. Always advance the health sig.
      const liveFps = pr.threads.filter((t) => !t.error).map(fp);
      seen.set(prKey, { threads: nextSeenThreads(prev.threads, liveFps, pr.needsRebase), health: healthSig });

      if (decision.kind === 'feedback')
        dispatcher.enqueue(pr, newThreads, { branchHealth: pr.branchHealth, ci: pr.ciFailing });
      else if (decision.kind === 'rebase')
        dispatcher.enqueueRebase(pr, { branchHealth: pr.branchHealth });
    }
    await writeState(prs);

    // Reclaim leftovers for PRs that were present last poll but are gone now (merged/
    // closed -> dropped out of scanAll). Each cleanup is best-effort: a failure must
    // not break the poll, so we wrap and continue. Also forget our per-poll tracking.
    const nowKeys = new Set(prs.map((p) => `${p.repo}#${p.number}`));
    for (const [k, oldPr] of prevByKey) {
      if (nowKeys.has(k)) continue;
      // Don't cleanup while a worker is in flight: cleanupPr force-removes the worktree
      // out from under the running `claude -p` and corrupts it. The dispatcher reclaims
      // it on worker exit (or a later poll does).
      if (dispatcher.isWorking(k)) continue;
      try { await cleanupPr(k, oldPr?.nameWithOwner); } catch (e) { log.error(`cleanup ${k} failed`, e.message); }
      seen.delete(k); outOfSyncPRs.delete(k); agentErrorPRs.delete(k); dispatcher.forget(k);
    }

    lastPollError = null;   // scan + derive + write succeeded — clear any prior failure
    const needPrs = new Set(state.placements.filter((p) => p.lane === 'needs').map((p) => p.prKey)).size;
    log.info(`${prs.length} PRs, ${needPrs} need you${account ? ` (scanned as @${account})` : ''}`);
  } catch (e) {
    // Do NOT swallow: a scan failure used to log only e.message and otherwise look
    // exactly like "no PRs need you". Record it (visible in state.json) + log the stack,
    // then re-persist so the dashboard can show the outage instead of a false all-clear.
    lastPollError = { at: new Date().toISOString(), message: String(e.message || e) };
    log.error('poll failed', e.stack || e.message);
    try { await writeState(state.prs); } catch (e2) { log.error('persist after poll failure failed', e2.message); }
  } finally {
    polling = false;
  }
}

// Arm the daemon: run the first cycle now and then on the interval. Idempotent — a
// second arm while already running is a no-op (so a double-click can't stack timers).
// poll() is fire-and-forget here: it can take minutes when it dispatches workers, and
// the caller (the HTTP handler) must respond immediately. persist() + notify so the
// dashboard reflects the new state right away (not only after the first scan lands).
async function startPolling() {
  if (pollTimer) return;
  pollingEnabled = true;
  try { await writeState(state.prs); } catch (e) { log.error('persist on start failed', e.message); }
  events.notifyStateUpdated();
  poll();
  pollTimer = setInterval(poll, config.pollMinutes * 60 * 1000);
}

// Disarm: stop the interval so no NEW scans/dispatches happen. A worker already
// mid-run is intentionally left to finish (aborting it would corrupt its worktree/
// session); it refreshes its card on exit as usual. Idempotent.
async function stopPolling() {
  if (!pollTimer) { pollingEnabled = false; return; }
  clearInterval(pollTimer);
  pollTimer = null;
  pollingEnabled = false;
  try { await writeState(state.prs); } catch (e) { log.error('persist on stop failed', e.message); }
  events.notifyStateUpdated();
}

// Models the Settings panel offers (Fast/Balanced/Deep map to these). Anything else is rejected.
const VALID_WORKER_MODELS = new Set(['haiku', 'sonnet', 'opus']);

// Apply Settings-panel edits server-authoritatively: validate, mutate the in-memory config
// so they take effect LIVE (onlyPRs is read each poll; pollMinutes re-arms the interval;
// workerModel/workerSensitivity are read at the next dispatch — existing sessions keep their
// model, new ones pick it up), and persist to config.local.json so a restart keeps them.
// Host/port/clone settings are NOT editable here — those bind at startup (see TODO_UX).
async function applyConfigEdits(edits) {
  const changed = [];
  if (Array.isArray(edits.onlyPRs)) {
    // Keep only well-formed "repo#number" keys; [] = watch ALL open PRs (the circuit-breaker off).
    config.onlyPRs = edits.onlyPRs.map((s) => String(s).trim()).filter((s) => /^[^#\s]+#\d+$/.test(s));
    changed.push('onlyPRs');
  }
  let pollChanged = false;
  if (edits.pollMinutes != null && Number.isFinite(Number(edits.pollMinutes))) {
    const m = clampPoll(edits.pollMinutes);   // [5,60] — same clamp as load + UI
    if (m !== config.pollMinutes) { config.pollMinutes = m; pollChanged = true; }
    changed.push('pollMinutes');
  }
  if (typeof edits.workerModel === 'string' && VALID_WORKER_MODELS.has(edits.workerModel)) {
    config.workerModel = edits.workerModel; changed.push('workerModel');
  }
  if (edits.workerSensitivity != null) {
    config.workerSensitivity = clampSensitivity(edits.workerSensitivity); changed.push('workerSensitivity');
  }
  // Re-arm the interval so a new cadence applies immediately — but ONLY while polling is on
  // (pollTimer set). If off, startPolling() reads the new value when the user next arms it.
  if (pollChanged && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = setInterval(poll, config.pollMinutes * 60 * 1000);
  }
  await persistConfigLocal({
    onlyPRs: config.onlyPRs, pollMinutes: config.pollMinutes,
    workerModel: config.workerModel, workerSensitivity: config.workerSensitivity,
  });
  return changed;
}

// Merge the edited flat keys into config.local.json, PRESERVING everything else (profile,
// profiles, and any other top-level keys). config.mjs reads these flat keys ABOVE the
// profile (env > file > profile), so the edits survive a restart.
async function persistConfigLocal(flat) {
  const path = join(config.baseDir, 'config.local.json');
  let existing = {};
  try { existing = JSON.parse(await readFile(path, 'utf8')); } catch {}
  await writeFile(path, JSON.stringify({ ...existing, ...flat }, null, 2) + '\n');
}

async function recordDecision(payload) {
  // Ensure data/ exists before writing: if the very first poll failed (GitHub
  // unreachable at startup), writeState() never ran and data/ was never created,
  // so this writeFile would throw ENOENT and crash the daemon from inside the
  // /decision req.on('end') async handler. mkdir is cheap + idempotent.
  await mkdir(DATA, { recursive: true });
  let all = [];
  try { all = JSON.parse(await readFile(DECISIONS, 'utf8')); } catch {}
  all.push({ ...payload, at: new Date().toISOString() });
  await writeFile(DECISIONS, JSON.stringify(all, null, 2));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${config.port}`);
  if (req.method === 'GET' && url.pathname === '/') {
    if (!hasDist) {
      res.writeHead(503, { 'content-type': 'text/plain' });
      res.end('Dashboard not built. Run `cd pr-controller-react && yarn build`, then reload.');
      return;
    }
    // An unguarded readFile rejection here would crash the daemon (unhandled rejection);
    // `hasDist` is latched at startup so the 503 guard can't catch a mid-request rebuild.
    // Read BEFORE writeHead so a rejection leaves the response uncommitted and the catch
    // can send a clean 500 (writeHead first would already have sent 200 → HEADERS_SENT).
    try {
      const html = await readFile(join(DIST, 'index.html'));
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html);
    } catch (e) {
      httpLog.error('serve index failed', e.message);
      try { res.writeHead(500, { 'content-type': 'text/plain' }); res.end('error'); } catch {}
    }
    return;
  }
  // Static assets from the React build (e.g. /assets/index-*.js, fonts).
  if (req.method === 'GET' && hasDist && url.pathname.startsWith('/assets/')) {
    const file = join(DIST, url.pathname);
    if (existsSync(file)) {
      // TOCTOU + crash guard: the file can vanish between existsSync and readFile (a
      // mid-request rebuild), and an unguarded rejection here would crash the daemon.
      // Read FIRST, then write the head, so the catch can send a clean 500.
      try {
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch (e) {
        httpLog.error('serve asset failed', e.message);
        try { res.writeHead(500, { 'content-type': 'text/plain' }); res.end('error'); } catch {}
      }
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
  // TEMP (debug): kick off a poll on demand instead of waiting for the poll timer.
  // Fire-and-forget — poll() can take minutes when it dispatches workers, so we
  // don't await it; the client re-fetches /state.json to see the result.
  if (req.method === 'POST' && url.pathname === '/poll') {
    const started = !polling;
    if (started) poll();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, started, reason: started ? 'poll started' : 'poll already running' }));
    return;
  }
  // Arm switch: turn the poll/dispatch loop on (first cycle now + interval) or off
  // (stop the interval; in-flight workers finish). Server-authoritative — the dashboard
  // renders pollingEnabled from /state.json and POSTs { on } here to flip it. Both
  // start/stop are idempotent, so a double-click can't stack or strand timers.
  if (req.method === 'POST' && url.pathname === '/polling') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const { on } = JSON.parse(body || '{}');
        if (on) await startPolling(); else await stopPolling();
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, pollingEnabled }));
      } catch (e) {
        httpLog.error('/polling failed', e.message);
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
      }
    });
    return;
  }
  // Settings panel save: edit the daemon's config (scope / cadence / model / sensitivity).
  // Server-authoritative — applies live in-memory + persists to config.local.json. The
  // dashboard renders current values from state.json's `settings` and POSTs the desired ones.
  if (req.method === 'POST' && url.pathname === '/config') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const changed = await applyConfigEdits(JSON.parse(body || '{}'));
        await writeState(state.prs);
        events.notifyStateUpdated();
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, changed, settings: buildSettings() }));
      } catch (e) {
        httpLog.error('/config failed', e.message);
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
      }
    });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/decision') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
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
        // Guard !pr (stale/closed prKey) so setPrJira doesn't deref undefined → 500.
        if (!pr) spawn = { spawned: false, reason: 'PR not found' };
        else if (!valid) spawn = { spawned: false, reason: `"${ticket}" is not a JIRA key like ABC-123` };
        else {
          await setPrJira(pr, ticket);
          // Re-scan so state.json reflects the new title and recomputes needsJira
          // (now false — the title has a key). Without this, a reload refetches the
          // stale state and the input box reappears until the next poll.
          await refreshOnePR(payload.prKey);
          spawn = { spawned: true, action: 'title updated' };
        }
      }
      // The user approved one or more proposed approaches. Stage them
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
      // Manual retry of a run that came back without a usable result (the workerFailed card's
      // Re-run). Re-dispatch the PR's open threads through the dispatcher — enqueue clears the
      // failure gate (e.failed) and fires a fresh worker; on a clean run the workerFailed
      // surface clears. Fold in CI/rebase so a health-only failure still re-fires.
      if (payload.action === 'rerun') {
        const pr = state.prs.find((p) => `${p.repo}#${p.number}` === payload.prKey);
        const threads = (pr?.threads || []).filter((t) => !t.error && t.threadId);
        if (!pr) spawn = { spawned: false, reason: 'PR not found' };
        else if (!threads.length && !pr.ciFailing && !pr.needsRebase)
          spawn = { spawned: false, reason: 'nothing to re-run — no open threads or branch work' };
        else {
          const queued = dispatcher.isWorking(payload.prKey);
          dispatcher.enqueue(pr, threads, { branchHealth: pr.branchHealth, ci: pr.ciFailing, rebaseOnConflict: pr.needsRebase });
          spawn = { spawned: true, queued, action: queued ? 'queued for next run' : 'agent re-dispatched' };
        }
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, scope: config.onlyPRs || [], spawn }));
      } catch (e) {
        // A throw inside this async req.on('end') handler is otherwise unhandled
        // and would crash the daemon. Respond 500 instead of dying.
        httpLog.error('/decision failed', e.message);
        try { res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: String(e.message || e) })); } catch {}
      }
    });
    return;
  }
  res.writeHead(404); res.end('not found');
});

// Resolve the gh-authenticated account ONCE, BEFORE we start listening — so config.login (the
// dispatch-suppression identity) is armed before any request (e.g. a manual /poll) can land.
// @me is both (a) the identity PR discovery runs as (`gh search prs --author @me`) and (b) the
// suppression key: dispatchable() skips a thread you spoke last on by comparing lastAuthor to
// config.login. If login was left empty (the default), adopt @me so the guard agrees with
// discovery — else workers fire on threads YOU had the last word on. On failure account stays null.
const srvLog = logger('server');
try { account = (await exec('gh', ['api', 'user', '--jq', '.login'], { env: ghEnv })).stdout.trim() || null; }
catch (e) { srvLog.warn('could not resolve gh account (gh api user) — is gh authed for this host?', String(e.message || e).slice(0, 160)); }
if (account && !config.login) config.login = account;

// Graceful shutdown. A process kill (SIGTERM from a redeploy/launchd, SIGINT from
// Ctrl-C) must NOT orphan in-flight `claude` workers — see drainWorkers (worker.mjs)
// for why orphans are dangerous (they keep pushing unsupervised and can collide with
// a fresh same-PR worker after restart). On the first signal: stop polling (no new
// scans/dispatches), stop accepting HTTP, drain in-flight workers (bounded by
// config.shutdownGraceMs), then exit. A second signal mid-drain forces an immediate
// exit (impatient double Ctrl-C). This makes a kill behave like the disarm toggle.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) { srvLog.warn(`${signal} again — forcing immediate exit`); process.exit(1); }
  shuttingDown = true;
  srvLog.info(`${signal} received — winding down (drain ≤${config.shutdownGraceMs}ms, then kill stragglers)`);
  try { await stopPolling(); } catch (e) { srvLog.error('stopPolling on shutdown failed', e.message); }
  server.close();   // stop accepting new connections; in-flight requests/SSE close on exit
  const r = await drainWorkers({ graceMs: config.shutdownGraceMs, log: srvLog });
  srvLog.info(`shutdown complete (${r.drained ? 'workers drained cleanly' : `terminated ${r.terminated}, killed ${r.killed}`})`);
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(config.port, async () => {
  const scoped = (config.onlyPRs || []).length;
  const scope = scoped ? `scoped to ${config.onlyPRs.join(', ')}` : 'ALL open non-draft PRs';
  srvLog.info(`PR dashboard on http://localhost:${config.port}  [${config.profile} @ ${config.host}]${account ? ` as @${account}` : ''} (${scope})`);

  // First-run safety: an unconfigured (no config.local.json) AND unscoped (empty onlyPRs) run is
  // FULLY LIVE — it scans every @me PR and dispatches real workers that commit/push/force-push.
  // onlyPRs is the only circuit-breaker, so surface that loudly instead of letting it look inert.
  if (!hasLocalConfig && !scoped)
    srvLog.warn('no config.local.json + empty onlyPRs — will scan ALL your open PRs and dispatch LIVE workers (commit/push/force-push). Set config.onlyPRs to a single sandbox PR to scope the blast radius before going live.');
  // cloneRoot fell back to ~/src and that dir is missing: clone reuse is silently disabled, so
  // every watched repo gets re-cloned fresh under worktrees/. Warn so it isn't a worker-time surprise.
  if (cloneRootDefaulted && !existsSync(config.cloneRoot))
    srvLog.warn(`cloneRoot ${config.cloneRoot} does not exist (defaulted ~/src) — local clones won't be reused; repos will be re-cloned under worktrees/. Set cloneRoot (or PRC_CLONE_ROOT) to your clones dir.`);

  // Polling is OFF by default and never auto-starts: arming the daemon (scan + dispatch
  // real workers) is an explicit, visible decision made from the dashboard, not a
  // side-effect of launching the process. Seed an empty idle state so /state.json has
  // the full shape (incl. pollingEnabled:false) before the first scan. Flip it on via
  // POST /polling (startPolling()).
  try { await writeState([]); } catch (e) { srvLog.error('initial writeState failed', e.message); }
  srvLog.info('polling is OFF by default — turn it on from the dashboard to start scanning + dispatching');
});
