// Pure-Node PR scanner. No Claude involved. Uses `gh` over GH_HOST.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config, ghEnv } from './config.mjs';

const exec = promisify(execFile);

async function gh(args) {
  const { stdout } = await exec('gh', args, { env: ghEnv, maxBuffer: 32 * 1024 * 1024 });
  return stdout;
}

// PR diff so the worker can judge scope/intent. Capped so a huge PR can't blow
// the worker's context — over the cap we hand back name-only + a note to read
// files directly in the worktree.
export async function fetchDiff(nameWithOwner, num, maxLines = 1500) {
  try {
    const full = await gh(['pr', 'diff', String(num), '--repo', nameWithOwner]);
    const lines = full.split('\n');
    if (lines.length <= maxLines) return { diff: full, truncated: false };
    const names = await gh(['pr', 'diff', String(num), '--repo', nameWithOwner, '--name-only']);
    return { diff: null, truncated: true, files: names.trim().split('\n'),
      note: `diff is ${lines.length} lines (> ${maxLines}); read changed files directly in the worktree` };
  } catch (e) {
    return { diff: null, error: String(e).slice(0, 200) };
  }
}

export async function listOpenPRs() {
  const out = await gh([
    'search', 'prs',
    '--author', '@me',
    '--state', 'open',
    '--limit', '100',
    '--json', 'number,title,repository,url,isDraft,createdAt,updatedAt',
  ]);
  return JSON.parse(out).map((p) => ({
    number: p.number,
    title: p.title,
    repo: p.repository.name,
    nameWithOwner: p.repository.nameWithOwner,
    url: p.url,
    isDraft: p.isDraft,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

const THREADS_QUERY = `
query($owner:String!, $name:String!, $num:Int!) {
  repository(owner:$owner, name:$name) {
    pullRequest(number:$num) {
      reviewDecision
      headRefName
      mergeable
      mergeStateStatus
      commits(last:1) {
        nodes { commit { statusCheckRollup { state
          contexts(first:100) {
            nodes {
              __typename
              ... on CheckRun { name conclusion status detailsUrl }
              ... on StatusContext { context state targetUrl }
            }
          }
        } } }
      }
      reviewThreads(first:100) {
        nodes {
          id isResolved isOutdated path line
          comments(first:30) {
            nodes { databaseId author{login} body createdAt url }
          }
        }
      }
    }
  }
}`;

export async function fetchThreads(repo, num) {
  const out = await gh([
    'api', 'graphql',
    '-f', `query=${THREADS_QUERY}`,
    '-F', `owner=${config.owner}`,
    '-F', `name=${repo}`,
    '-F', `num=${num}`,
  ]);
  const pr = JSON.parse(out).data.repository.pullRequest;
  const threads = (pr.reviewThreads?.nodes || [])
    .filter((t) => !t.isResolved && t.comments.nodes.length)
    .map((t) => {
      const first = t.comments.nodes[0];
      const last = t.comments.nodes[t.comments.nodes.length - 1];
      return {
        threadId: t.id,
        path: t.path,
        line: t.line,
        isOutdated: t.isOutdated,
        author: first.author?.login || 'unknown',
        body: first.body,
        url: first.url,
        commentCount: t.comments.nodes.length,
        // last author tells us if WE already replied last
        lastAuthor: last.author?.login || 'unknown',
        lastCommentId: last.databaseId,
      };
    });
  const rollup = pr.commits?.nodes?.[0]?.commit?.statusCheckRollup;
  const matches = (name, list) => list.some((s) => (name || '').toLowerCase().includes(s.toLowerCase()));
  const allFailing = (rollup?.contexts?.nodes || [])
    .map((c) => c.__typename === 'CheckRun'
      ? { name: c.name, state: c.conclusion || c.status, url: c.detailsUrl }
      : { name: c.context, state: c.state, url: c.targetUrl })
    .filter((c) => ['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED'].includes(c.state))
    .filter((c) => !matches(c.name, config.ignoreChecks));
  const complianceChecks = allFailing.filter((c) => matches(c.name, config.complianceChecks));
  const failingChecks = allFailing.filter((c) => !matches(c.name, config.complianceChecks));
  const branchHealth = {
    mergeable: pr.mergeable,            // MERGEABLE | CONFLICTING | UNKNOWN
    mergeState: pr.mergeStateStatus,    // BEHIND | DIRTY | BLOCKED | CLEAN | ...
    checkState: rollup?.state || null,  // SUCCESS | FAILURE | PENDING | null
    failingChecks,                      // code CI — worker fixes
    complianceChecks,                   // needs your input (e.g. JIRA ticket)
  };
  return { reviewDecision: pr.reviewDecision, headRefName: pr.headRefName, branchHealth, threads };
}

// Scan everything; returns the full snapshot the dashboard renders from.
export async function scanAll() {
  const prs = await listOpenPRs();
  const enriched = [];
  for (const pr of prs) {
    let reviewDecision = 'NONE';
    let headRefName = null;
    let branchHealth = null;
    let threads = [];
    try {
      const r = await fetchThreads(pr.repo, pr.number);
      reviewDecision = r.reviewDecision || 'NONE';
      headRefName = r.headRefName;
      branchHealth = r.branchHealth;
      threads = r.threads;
    } catch (e) {
      threads = [{ error: String(e).slice(0, 200) }];
    }
    enriched.push({ ...pr, reviewDecision, headRefName, branchHealth, threads });
  }
  return enriched;
}
