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
import { scanAll } from './scanner.mjs';
import { preClassify, spawnDiscussTerminal, runWorker } from './worker.mjs';
import { ensureWorktree } from './worktree.mjs';
import { dispatchable, needsJira, rebaseAllowed } from './rules.mjs';

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

let state = { updatedAt: null, safeMode: config.SAFE_MODE, prs: [] };
// prKey -> Set of "threadId:lastCommentId" seen last poll, for diff detection.
const seen = new Map();

const TIER_RANK = { 'hash-out': 0, 'agree-fix': 1, 'waiting-reviewer': 2, error: 3 };

const fp = (t) => `${t.threadId}:${t.lastCommentId}`;

async function poll() {
  try {
    const prs = await scanAll();
    for (const pr of prs) {
      pr.threads = pr.threads.map((t) => ({ ...t, ...preClassify(t) }));
      pr.needsYou = pr.threads.some((t) => t.tier === 'hash-out');
      pr.autoFixable = pr.threads.filter((t) => t.tier === 'agree-fix').length;
      pr.priority = Math.min(...pr.threads.map((t) => TIER_RANK[t.tier] ?? 9), 9);

      // Branch-health flags (separate trigger from review threads).
      const h = pr.branchHealth || {};
      pr.behindBase = rebaseAllowed(pr.reviewDecision, h.mergeState, h.mergeable);
      pr.ciFailing = (h.failingChecks || []).length > 0;  // code CI only

      // Compliance failing + no JIRA key in title => surface an input box for the ticket.
      pr.needsJira = needsJira(pr.title, h.complianceChecks);
      if (pr.needsJira) pr.needsYou = true;

      // Diff vs last poll: new threads, and whether branch health changed.
      const prKey = `${pr.repo}#${pr.number}`;
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
          pr.needsYou = true;
          pr.outOfSync = true;
          console.log(`[dispatch] ${prKey}: branch out of sync, surfacing instead of launching`);
        } else {
          const outPath = join(DATA, `worker-${pr.repo}-${pr.number}.json`);
          const r = await runWorker(pr, newThreads, wt.path, outPath,
            { detached: wt.detached, pushRefspec: wt.pushRefspec, branchHealth: pr.branchHealth, rebaseAllowed: pr.behindBase });
          console.log(`[dispatch] ${prKey}: ${newThreads.length} thread(s)${healthWork?' +health':''} ->`, r.spawned ? `session ${r.sessionId}` : r.reason, r.wouldRun || wt.plan || '');
        }
      }
    }
    prs.sort((a, b) => a.priority - b.priority || (b.needsYou - a.needsYou));
    state = { updatedAt: new Date().toISOString(), safeMode: config.SAFE_MODE, prs };
    await mkdir(DATA, { recursive: true });
    await writeFile(STATE, JSON.stringify(state, null, 2));
    console.log(`[poll] ${prs.length} PRs, ${prs.filter(p=>p.needsYou).length} need you`);
  } catch (e) {
    console.error('[poll] failed:', e.message);
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
  if (req.method === 'POST' && url.pathname === '/decision') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      const payload = JSON.parse(body || '{}');
      await recordDecision(payload);
      let spawn = { spawned: false, reason: 'SAFE_MODE: nothing executed' };
      if (payload.action === 'discuss') {
        const pr = state.prs.find((p) => `${p.repo}#${p.number}` === payload.prKey);
        const thread = pr?.threads.find((t) => t.threadId === payload.threadId);
        if (pr && thread) spawn = spawnDiscussTerminal(pr, thread, '(worktree-stub)');
      }
      if (payload.action === 'set-jira') {
        const pr = state.prs.find((p) => `${p.repo}#${p.number}` === payload.prKey);
        const ticket = (payload.ticket || '').trim();
        const valid = new RegExp(`^${config.jiraPattern}$`).test(ticket);
        if (!valid) spawn = { spawned: false, reason: `"${ticket}" is not a JIRA key like ABC-123` };
        else if (config.SAFE_MODE) spawn = { spawned: false, reason: `SAFE_MODE: would set title to "[${ticket}] ${pr?.title}"` };
        else { await setPrJira(pr, ticket); spawn = { spawned: true, action: 'title updated' }; }
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, safeMode: config.SAFE_MODE, spawn }));
    });
    return;
  }
  res.writeHead(404); res.end('not found');
});

server.listen(config.port, async () => {
  console.log(`PR dashboard on http://localhost:${config.port}  (SAFE_MODE=${config.SAFE_MODE})`);
  await poll();
  setInterval(poll, config.pollMinutes * 60 * 1000);
});
