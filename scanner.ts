// Pure-Node PR scanner. No Claude involved. Uses `gh` over GH_HOST.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config, ghEnv } from './config.ts';
import { categorizeChecks, inScope } from './rules.ts';
import { logger } from './log.ts';
import type { Pr, Thread, BranchHealth, Check } from './types.ts';

const exec = promisify(execFile);
const slog = logger('scanner');

// Shape of the errors gh/execFile reject with (a subset of the Node child_process
// error). Treated as external/untrusted — every field is optional.
interface GhError {
  message?: string;
  stderr?: string;
  stdout?: string;
}

// The enriched subset parsePullRequest merges onto a base Pr (see types.Pr's
// "enriched" block). `title` is carried only when the node has it (it merges OVER the
// authoritative base title), so it's optional here. Merged with the base by the callers.
type EnrichedPr = Pick<Pr, 'reviewDecision' | 'headRefName' | 'baseRefName' | 'branchHealth' | 'threads'>
  & Partial<Pick<Pr, 'title'>>;

// One entry of the per-PR cache: the last enriched record + the base meta needed
// to re-fetch it directly (prKey carries no owner).
interface CacheEntry {
  record: Pr;
  updatedAt?: string;
  nameWithOwner?: string;
}

// ---------------------------------------------------------------------------
// Rate-limit handling (TASK 12)
// ---------------------------------------------------------------------------

// PURE classifier: does this gh error look like a GitHub rate-limit response?
// Inspects the error's message/stderr/stdout/exit code for the documented
// signals: "API rate limit exceeded", "secondary rate limit", "was submitted
// too quickly", and the 403/429 HTTP statuses gh surfaces in its stderr.
export function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  // gh/execFile rejects with an Error-like object; narrow it (or a bare string).
  const e = (typeof err === 'string' ? null : err) as GhError | null;
  const text = [
    e?.message,
    e?.stderr,
    e?.stdout,
    typeof err === 'string' ? err : '',
  ].filter(Boolean).join('\n').toLowerCase();
  if (!text) return false;
  if (text.includes('api rate limit exceeded')) return true;
  if (text.includes('secondary rate limit')) return true;
  if (text.includes('was submitted too quickly')) return true;
  if (text.includes('rate limit')) return true;
  // HTTP status signals gh prints. A 403/429 WITH rate-limit wording is a throttle.
  if (/\b(403|429)\b/.test(text) && /(rate|limit|too many)/.test(text)) return true;
  // A bare 429 (Too Many Requests) is itself a throttle. A bare 403 is NOT — it's
  // usually auth/permission; a rate-limit 403 always carries explicit text caught
  // above, so we don't needlessly retry/backoff a permission error for ~15s.
  if (/\b429\b/.test(text)) return true;
  return false;
}

// PURE: classify a gh failure so a throttle/auth/permission problem is distinguishable
// from an ordinary error, instead of collapsing every failure into one opaque {error}
// thread. Returns 'rateLimit' | 'auth' | 'forbidden' | 'graphql' | 'other'.
export function classifyGhError(err: unknown): NonNullable<Thread['errorKind']> {
  if (isRateLimitError(err)) return 'rateLimit';
  // gh/execFile rejects with an Error-like object; narrow it (or a bare string).
  const e = (typeof err === 'string' ? null : err) as GhError | null;
  const text = [e?.message, e?.stderr, e?.stdout, typeof err === 'string' ? err : '']
    .filter(Boolean).join('\n').toLowerCase();
  if (/\b401\b/.test(text) || text.includes('bad credentials') || text.includes('gh auth') || text.includes('authentication')) return 'auth';
  if (/\b403\b/.test(text) || text.includes('forbidden') || text.includes('permission')) return 'forbidden';
  if (text.includes('graphql') || text.includes('could not resolve to') || text.includes('not found') || /\b404\b/.test(text)) return 'graphql';
  return 'other';
}

// Bounded exponential backoff. Retries `fn` on rate-limit errors with an
// increasing delay, then rethrows the last error so the caller's existing
// catch -> {error} behavior is preserved. Non-rate-limit errors rethrow
// immediately (no point retrying a 404). Delay schedule is overridable for
// tests; sleep is injectable so tests don't actually wait.
const DEFAULT_RL_DELAYS = [1000, 4000, 10000]; // ms; ~retries=3
interface RetryOpts {
  delays?: number[];
  sleep?: (ms: number) => Promise<unknown>;
  log?: (m: string) => void;
}
async function withRateLimitRetry<T>(fn: () => Promise<T>, {
  delays = DEFAULT_RL_DELAYS,
  sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)),
  log = (m: string) => slog.warn(m),
}: RetryOpts = {}): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isRateLimitError(e) || attempt === delays.length) throw e;
      const ms = delays[attempt];
      log(`rate limited, backing off ${Math.round(ms / 1000)}s (attempt ${attempt + 1}/${delays.length})`);
      await sleep(ms);
    }
  }
  throw lastErr;
}

async function gh(args: string[]): Promise<string> {
  const { stdout } = await withRateLimitRetry(() =>
    exec('gh', args, { env: ghEnv, maxBuffer: 32 * 1024 * 1024 }));
  return stdout as string;
}

// PR diff so the worker can judge scope/intent. Capped so a huge PR can't blow
// the worker's context — over the cap we hand back name-only + a note to read
// files directly in the worktree.
export async function fetchDiff(nameWithOwner: string, num: number | string, maxLines = 1500) {
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

// One row of `gh search prs --json ...` — external JSON, narrowed at the boundary.
interface SearchPrRow {
  number: number;
  title: string;
  repository: { name: string; nameWithOwner: string };
  url: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listOpenPRs(): Promise<Pr[]> {
  const out = await gh([
    'search', 'prs',
    '--author', '@me',
    '--state', 'open',
    '--limit', '100',
    '--json', 'number,title,repository,url,isDraft,createdAt,updatedAt',
  ]);
  // External CLI JSON — cast to the documented --json shape at the I/O boundary.
  const rows = JSON.parse(out) as SearchPrRow[];
  return rows.map((p) => ({
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

// The per-PR field set, factored out so the single-PR query and each aliased
// block of the batched query share ONE definition (no drift between paths).
const PR_FIELDS = `
  state
  title
  reviewDecision
  headRefName
  baseRefName
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
  }`;

const THREADS_QUERY = `
query($owner:String!, $name:String!, $num:Int!) {
  repository(owner:$owner, name:$name) {
    pullRequest(number:$num) {${PR_FIELDS}
    }
  }
}`;

// Split a "owner/repo" (or bare repo) into [owner, name], defaulting to
// config.owner when only a bare repo name was passed (defensive — all live
// callers pass nameWithOwner).
function ownerNameOf(nameWithOwner: string): [string, string] {
  return String(nameWithOwner).includes('/')
    ? (nameWithOwner.split('/') as [string, string])
    : [config.owner, nameWithOwner];
}

// PURE parse: turn a GraphQL `pullRequest` node into the enriched
// {reviewDecision, headRefName, baseRefName, branchHealth, threads} shape.
// Shared by the single-PR path, the batched path, and the direct-node path so
// they can never drift. No I/O. Returns null for a missing/null node (a PR that
// 404'd or fell out of an aliased response).
// Raw GraphQL `pullRequest` node shapes (external GitHub data). Loosely typed and
// optional throughout — parsePullRequest narrows them into the canonical records.
interface RawComment {
  databaseId: number;
  author?: { login?: string } | null;
  body: string;
  createdAt?: string;
  url: string;
}
interface RawReviewThread {
  id: string;
  isResolved?: boolean;
  isOutdated: boolean;
  path: string;
  line: number | null;
  comments: { nodes: RawComment[] };
}
interface RawCheckContext {
  __typename?: string;
  name?: string;
  conclusion?: string | null;
  status?: string;
  detailsUrl?: string | null;
  context?: string;
  state?: string;
  targetUrl?: string | null;
}
interface RawPrNode {
  state?: string;
  title?: string;
  reviewDecision?: string | null;
  headRefName?: string;
  baseRefName?: string;
  mergeable: BranchHealth['mergeable'];
  mergeStateStatus: BranchHealth['mergeState'];
  commits?: { nodes?: Array<{ commit?: { statusCheckRollup?: {
    state?: BranchHealth['checkState'];
    contexts?: { nodes?: RawCheckContext[] };
  } | null } }> };
  reviewThreads?: { nodes?: RawReviewThread[] };
}

export function parsePullRequest(pr: unknown): EnrichedPr | null {
  if (!pr) return null;
  // External GraphQL node — cast to the documented query shape at the I/O boundary.
  const node = pr as RawPrNode;
  const threads: Thread[] = (node.reviewThreads?.nodes || [])
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
        lastAuthor: last.author?.login || 'unknown',
        lastBody: last.body || '',
        lastCommentId: last.databaseId,
      };
    });
  // NOTE: threads are RAW here (no opinions). The @claude-debug reviewer re-attribution is
  // applied downstream in derive.deriveRecord (the canonical-record boundary), not in this
  // pure parse layer — so the scanner stays "raw GitHub data, no opinions".
  const rollup = node.commits?.nodes?.[0]?.commit?.statusCheckRollup;
  // CheckRun vs StatusContext normalize to the same {name,state,url} Check shape; the
  // GraphQL union guarantees the active branch's fields, so cast each to Check.
  const failed: Check[] = (rollup?.contexts?.nodes || [])
    .map((c) => c.__typename === 'CheckRun'
      ? { name: c.name, state: c.conclusion || c.status, url: c.detailsUrl } as Check
      : { name: c.context, state: c.state, url: c.targetUrl } as Check)
    .filter((c) => ['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED'].includes(c.state));
  const { codeChecks: failingChecks, complianceChecks } = categorizeChecks(failed);
  const branchHealth: BranchHealth = {
    mergeable: node.mergeable,          // MERGEABLE | CONFLICTING | UNKNOWN
    mergeState: node.mergeStateStatus,  // BEHIND | DIRTY | BLOCKED | CLEAN | ...
    checkState: rollup?.state || null,  // SUCCESS | FAILURE | PENDING | null
    failingChecks,                      // code CI — worker fixes
    complianceChecks,                   // needs your input (e.g. JIRA ticket)
  };
  // Only carry `title` when the node has it: this merges OVER the base meta from
  // listOpenPRs, so an undefined title would wipe the authoritative base title.
  return { ...(node.title != null ? { title: node.title } : {}), reviewDecision: node.reviewDecision, headRefName: node.headRefName, baseRefName: node.baseRefName, branchHealth, threads };
}

// Raw single-PR fetch: returns the GraphQL `pullRequest` NODE (or null) for one
// PR. Owner/name go with -f (string-literal) — NOT -F, which type-coerces a
// numeric-looking owner/repo and fails against the String! vars (this matches the
// batched path's flag handling); num uses -F. Derives owner/name from the PR's OWN
// "owner/repo" (cross-org safe), not the global config.owner.
async function fetchOnePrRaw(nameWithOwner: string, num: number): Promise<unknown> {
  const [owner, name] = ownerNameOf(nameWithOwner);
  const out = await gh([
    'api', 'graphql',
    '-f', `query=${THREADS_QUERY}`,
    '-f', `owner=${owner}`,
    '-f', `name=${name}`,
    '-F', `num=${num}`,
  ]);
  // Optional-chain the response shape (matches the batched path's d[`p${i}`]?.pullRequest):
  // a `{ data: null }` GraphQL error yields null here instead of a "cannot read properties of
  // null" throw. Both callers handle null/throw identically, so this just makes the contract explicit.
  // External GraphQL envelope — cast the parse, return the (unknown) pullRequest node.
  const parsed = JSON.parse(out) as { data?: { repository?: { pullRequest?: unknown } } };
  return parsed.data?.repository?.pullRequest ?? null;
}

// PURE: is this raw `pullRequest` node a LIVE (open) PR? GitHub's
// repository.pullRequest(number:) returns the node for CLOSED and MERGED PRs too —
// only a never-existed number is null. So a single-PR lookup must check `state`,
// not just non-null, or a just-merged PR looks live and never gets cleaned up.
export function isLivePrNode(node: unknown): boolean {
  return !!node && (node as RawPrNode).state === 'OPEN';
}

export async function fetchThreads(nameWithOwner: string, num: number): Promise<EnrichedPr | null> {
  return parsePullRequest(await fetchOnePrRaw(nameWithOwner, num));
}

// ---------------------------------------------------------------------------
// Batched GraphQL fan-out (TASK 9)
// ---------------------------------------------------------------------------

// PURE builder: given a list of PRs (each {nameWithOwner, number}), produce a
// SINGLE aliased GraphQL query + variables object. PRs can be cross-org, so we
// cannot share one repository() block — each PR gets its own alias p0,p1,...
// with its own owner/name/number variables. The caller chunks the list before
// calling this; this builds exactly one request's worth.
export function buildBatchedQuery(prs: Pick<Pr, 'nameWithOwner' | 'number'>[]) {
  const vars: Record<string, string | number> = {};
  const blocks = prs.map((pr, i) => {
    const [owner, name] = ownerNameOf(pr.nameWithOwner);
    vars[`o${i}`] = owner;
    vars[`n${i}`] = name;
    vars[`num${i}`] = Number(pr.number);
    return `  p${i}: repository(owner:$o${i}, name:$n${i}) {
    pullRequest(number:$num${i}) {${PR_FIELDS}
    }
  }`;
  });
  const decls = prs.map((_, i) => `$o${i}:String!, $n${i}:String!, $num${i}:Int!`).join(', ');
  const query = `
query(${decls}) {
${blocks.join('\n')}
}`;
  return { query, variables: vars };
}

// PURE parser for a batched response. `prs` is the same list passed to the
// builder (same order -> same aliases); `data` is the GraphQL `data` object.
// Returns enriched records aligned to `prs` by index. A missing/null alias
// (one PR errored or 404'd inside an otherwise-good batch) yields null for that
// slot rather than throwing — the caller falls those back to the per-PR path.
export function parseBatchedResponse(prs: Pr[], data: unknown): (Pr | null)[] {
  // External GraphQL `data` object: aliased p0,p1,... each wrapping a pullRequest node.
  const d = (data || {}) as Record<string, { pullRequest?: unknown } | undefined>;
  return prs.map((pr, i) => {
    const node = d[`p${i}`]?.pullRequest;
    const parsed = parsePullRequest(node);
    return parsed ? { ...pr, ...parsed } : null;
  });
}

// How many aliased PRs to put in one request. Each alias adds 3 variables and a
// repository block; staying well under GraphQL node/complexity limits.
const BATCH_SIZE = 20;

// Run ONE batched request for a chunk of PRs via `gh api graphql`, passing each
// variable with -F (numbers) / -f (strings). Returns enriched records aligned to
// `chunk` (null for any alias that came back null). Throws on a transport/parse
// failure so the caller can fall back per-PR.
async function fetchBatch(chunk: Pr[]): Promise<(Pr | null)[]> {
  const { query, variables } = buildBatchedQuery(chunk);
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [k, v] of Object.entries(variables)) {
    // gh: -F coerces numbers/bools; -f keeps strings literal. owner/name are
    // strings (-f), numbers use -F.
    args.push(typeof v === 'number' ? '-F' : '-f', `${k}=${v}`);
  }
  const out = await gh(args);
  // External GraphQL envelope — cast the parse, hand the `data` object to the parser.
  const parsed = JSON.parse(out) as { data?: unknown };
  return parseBatchedResponse(chunk, parsed.data);
}

// Enrich many PRs with as few GraphQL calls as possible. Chunks into batched
// aliased requests; on ANY batched-call failure for a chunk, falls back to the
// existing per-PR sequential path so one bad PR can't blank the whole scan. Any
// individual null alias inside a good batch also falls back per-PR.
async function enrichMany(prs: Pr[]): Promise<Pr[]> {
  const out: Pr[] = [];
  for (let i = 0; i < prs.length; i += BATCH_SIZE) {
    const chunk = prs.slice(i, i + BATCH_SIZE);
    let records;
    try {
      records = await fetchBatch(chunk);
    } catch (e) {
      // A rate-limit hits every PR in the chunk, so the per-PR fallback would re-run the
      // full backoff ladder for each one, hammering an already-throttled endpoint. Stub
      // the whole chunk instead; the per-PR fallback stays for genuine single-PR failures.
      if (isRateLimitError(e)) {
        slog.warn(`batched fetch rate-limited for ${chunk.length} PR(s); not fanning out per-PR`, String(e).slice(0, 160));
        for (const pr of chunk)
          // Stub record: branchHealth null + a scan-error stub thread (a partial Thread the
          // downstream guards/derive expect). Cast over the strict Pr/Thread shapes.
          out.push({ ...pr, reviewDecision: 'NONE', headRefName: null, baseRefName: null,
            branchHealth: null, threads: [{ error: String(e).slice(0, 200), errorKind: 'rateLimit' }] } as unknown as Pr);
        continue;
      }
      slog.warn(`batched fetch failed for ${chunk.length} PR(s), falling back per-PR`, String(e).slice(0, 160));
      for (const pr of chunk) out.push(await scanOne(pr));
      continue;
    }
    for (let j = 0; j < chunk.length; j += 1) {
      // A null alias = that PR errored inside an otherwise-good batch; re-fetch
      // it the old way so it gets the normal {error}-thread treatment.
      out.push(records[j] || await scanOne(chunk[j]));
    }
  }
  return out;
}

// Enrich one PR (from listOpenPRs) with threads + branch health. Shared by
// scanAll() and the dispatcher's per-PR refresh after a worker run.
export async function scanOne(pr: Pr): Promise<Pr> {
  let reviewDecision: string | null = 'NONE';
  let headRefName: string | null | undefined = null;
  let baseRefName: string | null | undefined = null;
  let branchHealth: BranchHealth | null = null;
  // The success path assigns parsed Thread[]; the catch path assigns a single scan-error
  // stub (a partial Thread the downstream guards/derive expect). Type accordingly.
  let threads: Thread[] | Array<{ error: string; errorKind: NonNullable<Thread['errorKind']> }> = [];
  try {
    const r = await fetchThreads(pr.nameWithOwner, pr.number);
    reviewDecision = r!.reviewDecision || 'NONE';
    headRefName = r!.headRefName;
    baseRefName = r!.baseRefName;
    branchHealth = r!.branchHealth ?? null;
    threads = r!.threads as Thread[];
  } catch (e) {
    const errorKind = classifyGhError(e);   // rateLimit | auth | forbidden | graphql | other
    slog.warn(`scan ${pr.repo}#${pr.number} failed [${errorKind}]`, String(e).slice(0, 200));
    threads = [{ error: String(e).slice(0, 200), errorKind }];
  }
  // headRefName/baseRefName/branchHealth may be null here (scan-error path); the strict Pr
  // shape narrows them to string|undefined / BranchHealth, but the pipeline guards for null.
  return { ...pr, reviewDecision, headRefName, baseRefName, branchHealth, threads } as unknown as Pr;
}

// ---------------------------------------------------------------------------
// Per-PR cache + updatedAt change-filter (TASK 10 + 11)
// ---------------------------------------------------------------------------

// Module-level cache mapping prKey ("repo#number") -> the last enriched record
// plus its base meta. Populated on every scanAll(). Two jobs:
//  - TASK 10: scanOnePr(prKey) needs the PR's nameWithOwner (prKey has no owner)
//    to do a direct single-PR fetch instead of a full listOpenPRs search.
//  - TASK 11: lets us skip re-enriching a PR whose updatedAt is unchanged since
//    the last poll by reusing the cached enriched record.
const prCache = new Map<string, CacheEntry>(); // prKey -> { record, updatedAt, nameWithOwner }

// Re-enrich-everything floor. updatedAt is lossy (it doesn't always bump on CI
// flips or thread resolves), so every Kth scanAll we re-enrich ALL in-scope PRs
// regardless of updatedAt. K is config.reenrichFloor (env PRC_REENRICH_FLOOR).
let scanCounter = 0;

// PURE decision: should this PR be re-enriched this scan? Re-enrich when the
// floor is reached (forceFloor), when there's no cached record yet (cold), or
// when updatedAt changed since the cached record. Skip only when we have a
// cached record AND updatedAt is unchanged AND the floor isn't due.
export function shouldReenrich(pr: Pr, cached: CacheEntry | undefined, forceFloor: boolean): boolean {
  if (forceFloor) return true;
  if (!cached || !cached.record) return true;
  // GitHub computes mergeability lazily (first read is UNKNOWN, settles later) but does
  // NOT bump updatedAt when it settles. So the updatedAt fast-path would pin a cached
  // UNKNOWN until the floor fires (~hours), silently hiding a conflict (needsRebase/
  // isBehindBase read UNKNOWN as clean). Re-fetch until mergeability is known.
  if (cached.record.branchHealth?.mergeable === 'UNKNOWN') return true;
  return pr.updatedAt !== cached.updatedAt;
}

// Look up a single open in-scope PR by "repo#number" and enrich it. Returns null
// if it's no longer open / in scope. Used to refresh one PR after a worker run.
//
// TASK 10: avoid a full `gh search prs` on every worker exit. We keep a cache of
// {prKey -> nameWithOwner + base meta} from the last scanAll(); a cache HIT does
// a direct single-PR GraphQL fetch. Only a cold cache MISS falls back to the old
// listOpenPRs path.
export async function scanOnePr(prKey: string): Promise<Pr | null> {
  if (!inScope(prKey)) return null;
  const cached = prCache.get(prKey);
  if (cached && cached.nameWithOwner) {
    const num = Number(prKey.split('#')[1]);
    try {
      const node = await fetchOnePrRaw(cached.nameWithOwner, num);
      // A CLOSED/MERGED PR still returns a node (only a never-existed number is
      // null). Treat anything non-OPEN as gone so refreshOnePR drops it and reclaims
      // its worktree/session NOW, instead of letting it linger until the next full scan.
      if (!isLivePrNode(node)) return null;
      const r = parsePullRequest(node);
      const base = cached.record
        ? { number: cached.record.number, title: cached.record.title, repo: cached.record.repo,
            nameWithOwner: cached.record.nameWithOwner, url: cached.record.url, isDraft: cached.record.isDraft,
            createdAt: cached.record.createdAt, updatedAt: cached.record.updatedAt }
        : { number: num, repo: prKey.split('#')[0], nameWithOwner: cached.nameWithOwner };
      // r may be null when the node didn't parse; the original accesses r.* directly so a
      // null throws into the catch below (then the cold-cache fallback). Preserve that.
      const enriched = {
        ...base,
        // Prefer the freshly-fetched title: otherwise the set-jira refresh recomputes
        // needsJira against the stale cached title and the JIRA input box reappears.
        title: r!.title ?? base.title,
        reviewDecision: r!.reviewDecision || 'NONE',
        headRefName: r!.headRefName,
        baseRefName: r!.baseRefName,
        branchHealth: r!.branchHealth,
        threads: r!.threads,
      } as unknown as Pr;
      // Refresh the cache so a subsequent updatedAt diff sees the latest record.
      prCache.set(prKey, { record: enriched, updatedAt: enriched.updatedAt, nameWithOwner: cached.nameWithOwner });
      return enriched;
    } catch {
      // Direct fetch threw (transient gh/network error, or the repo/PR vanished).
      // Fall through to the cold-cache path below so we get a correct open/in-scope
      // answer rather than guessing. (A non-OPEN node is handled above as null.)
    }
  }
  // Cold cache (or direct fetch failed): the original full-search path.
  const found = (await listOpenPRs()).find((pr) => `${pr.repo}#${pr.number}` === prKey);
  if (!found) return null;
  const enriched = await scanOne(found);
  prCache.set(prKey, { record: enriched, updatedAt: found.updatedAt, nameWithOwner: found.nameWithOwner });
  return enriched;
}

// Scan everything; returns the full snapshot the dashboard renders from.
export async function scanAll() {
  // Restrict to the configured scope BEFORE fetching threads — out-of-scope PRs
  // are invisible to the daemon (not scanned, not rendered, never worked).
  const discovered = (await listOpenPRs()).filter((pr) => inScope(`${pr.repo}#${pr.number}`));
  // Default (no whitelist) = all your open NON-DRAFT PRs. A whitelist takes exactly what's
  // listed (drafts included — you named them).
  const prs = (config.onlyPRs && config.onlyPRs.length) ? discovered : discovered.filter((pr) => !pr.isDraft);

  // TASK 11: floor — every Kth scan re-enrich EVERYTHING regardless of updatedAt
  // (updatedAt misses CI flips / thread resolves). scanCounter increments here.
  const floor = Math.max(1, Number(config.reenrichFloor) || 5);
  scanCounter += 1;
  const forceFloor = scanCounter % floor === 0;

  // TASK 11: split into PRs that actually need re-enrich vs ones we can reuse
  // from cache (unchanged updatedAt within the floor window).
  const toEnrich: Pr[] = [];
  const reused: Pr[] = [];
  const liveKeys = new Set<string>();
  for (const pr of prs) {
    const prKey = `${pr.repo}#${pr.number}`;
    liveKeys.add(prKey);
    const cached = prCache.get(prKey);
    if (shouldReenrich(pr, cached, forceFloor)) {
      toEnrich.push(pr);
    } else {
      // Reuse the cached enriched record but carry forward the freshest base
      // meta from listOpenPRs (title/url could change without a thread change).
      // shouldReenrich returned false ⇒ cached (and cached.record) exist.
      reused.push({ ...cached!.record, ...pr });
    }
  }

  // Observability: report the change-filter's effect each scan (how many PRs the
  // updatedAt filter let us reuse from cache vs. re-fetch), and when the floor fires.
  slog.info(`scan #${scanCounter}: ${toEnrich.length} enriched, ${reused.length} reused from cache${forceFloor ? ' (floor re-enrich)' : ''}`);

  // TASK 9: batch the fan-out for the PRs that need re-enriching.
  const freshlyEnriched = await enrichMany(toEnrich);

  // Refresh cache for the freshly-enriched PRs; prune cache entries for PRs no
  // longer open/in-scope so it can't grow unbounded.
  for (const e of freshlyEnriched) {
    const prKey = `${e.repo}#${e.number}`;
    prCache.set(prKey, { record: e, updatedAt: e.updatedAt, nameWithOwner: e.nameWithOwner });
  }
  for (const e of reused) {
    const prKey = `${e.repo}#${e.number}`;
    prCache.set(prKey, { record: e, updatedAt: e.updatedAt, nameWithOwner: e.nameWithOwner });
  }
  for (const key of [...prCache.keys()]) if (!liveKeys.has(key)) prCache.delete(key);

  // Return in the original listOpenPRs order so the snapshot is stable.
  const byKey = new Map();
  for (const e of [...freshlyEnriched, ...reused]) byKey.set(`${e.repo}#${e.number}`, e);
  return prs.map((pr) => byKey.get(`${pr.repo}#${pr.number}`)).filter(Boolean);
}

// Test-only hook: reset the module cache + scan counter so unit tests are
// isolated. Not used by the daemon.
export function __resetScannerState() {
  prCache.clear();
  scanCounter = 0;
}
