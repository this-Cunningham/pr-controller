// Canonical data shapes for the pr-controller daemon — the single home for every type
// that crosses a module boundary in the pipeline (scanner → rules → derive → placements
// → server → state.json). Defining each shape once makes producer/consumer drift a
// COMPILE error rather than a silent runtime mismatch. The frontend mirrors the wire
// subset in pr-controller-react/src/features/dashboard/wire.ts (it must not import across
// the repo root — this file pulls node-only types); ARCHITECTURE.md's state.json block is
// the conceptual source both sides track.

// ── Routing vocabulary (authoritative copies live in placements.mjs; these unions lock
//    the string literals so a typo'd disposition/lane is a type error) ──────────────────

/** The three dashboard tabs. Mirror of placements.LANES. */
export type Lane = 'needs' | 'progress' | 'waiting';

/** Per-thread verdict from rules.deriveDisposition. */
export type ThreadDisposition =
  | 'needsYourApproval'
  | 'agentError'
  | 'notYetReviewed'
  | 'agentAutoFixed'
  | 'awaitingReviewer'
  | 'agentAcknowledged';

/** Non-thread (branch/jira/live) verdicts minted in placements.placementsFor. */
export type PseudoDisposition =
  | 'jiraNeeded'
  | 'workerFailed'
  | 'branchOutOfSync'
  | 'branchConflict'
  | 'agentWorking';

export type Disposition = ThreadDisposition | PseudoDisposition;

/** What a placement row is about. */
export type SubjectKind = 'thread' | 'jira' | 'branch' | 'live';

/** Design-system short tag (styling only — never routing). Mapped in adapt.js. */
export type Tag = 'input' | 'fixed' | 'waiting' | 'pending' | 'praise' | 'error';

/** The worker's per-thread response in its result JSON. Mirror of rules.WORKER_RESPONSES. */
export type WorkerResponse = 'fix' | 'praise' | 'surface';

/** Ephemeral in-flight status pushed over SSE (events.mjs), overlaid by the client. */
export type LiveStatus = 'working' | 'rebasing';

// ── GitHub-origin enums the pipeline switches on (precise unions so literal comparisons
//    are checked; the scanner casts raw JSON into these at the I/O boundary) ────────────

export type Mergeable = 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
export type MergeStateStatus =
  | 'BEHIND' | 'BLOCKED' | 'CLEAN' | 'DIRTY' | 'DRAFT' | 'HAS_HOOKS' | 'UNKNOWN' | 'UNSTABLE';
export type CheckState = 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR' | 'EXPECTED';

// ── Core records ──────────────────────────────────────────────────────────────────────

/** One CI/status check, normalized from a CheckRun or StatusContext (scanner.parsePullRequest). */
export interface Check {
  name: string;
  state: string;
  url?: string | null;
}

/** Branch + CI rollup for a PR (scanner.parsePullRequest). */
export interface BranchHealth {
  mergeable: Mergeable;
  mergeState: MergeStateStatus | null;
  checkState: CheckState | null;
  failingChecks: Check[];     // code CI — the worker fixes these
  complianceChecks: Check[];  // needs your input (e.g. a JIRA ticket)
}

/** A raw, unresolved review thread (scanner.parsePullRequest — no opinions). */
export interface Thread {
  threadId: string;
  path: string;
  line: number | null;
  isOutdated: boolean;
  author: string;
  body: string;
  url: string;
  commentCount: number;
  lastAuthor: string;
  lastBody: string;
  lastCommentId: number;
  /** Set on a scan-error stub (a thread we couldn't fetch); escalates to agentError. */
  error?: string;
  errorKind?: 'rateLimit' | 'auth' | 'forbidden' | 'graphql' | 'other';
}

/** A thread after derive.deriveRecord has attached the worker's verdict. */
export interface ThreadWithDisposition extends Thread {
  disposition: Disposition;
  reason: string;
  suggestedReply?: string;
  suggestedApproach?: string;
}

/** One entry in the worker's result JSON `actions[]` (validated by rules.validateWorkerResult). */
export interface Action {
  threadId: string;
  response: WorkerResponse;
  reason?: string;
  suggestedReply?: string;
  suggestedApproach?: string;
}

/** The worker-result file (data/worker-<repo>-<num>.json), after validation. Written by the
 *  model so its raw form is untrusted — validateWorkerResult narrows it to this. */
export interface WorkerResult {
  actions?: Action[];
  branchHealth?: {
    surfaced?: string | null;
    ciReran?: boolean;
  };
}

/** The growing per-PR record. Base fields come from scanner.listOpenPRs; scanner.scanOne
 *  merges in the enriched fields; derive.deriveRecord mutates in the derived flags. The
 *  pipeline treats `pr` as one object that gains fields as it flows, so enriched/derived
 *  fields are optional — the guards in the code (`pr.threads || []`, `pr.branchHealth || {}`)
 *  are exactly what strict null-checks now validate. */
export interface Pr {
  // base meta (listOpenPRs)
  number: number;
  title: string;
  repo: string;
  nameWithOwner: string;
  url: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;

  // enriched (parsePullRequest, merged in scanOne). headRefName/baseRefName/branchHealth
  // are null on the scan-error / rate-limit stub paths (scanner.ts), so they admit null;
  // consumers guard with `|| {}` / truthiness before use.
  state?: string;
  reviewDecision?: string | null;
  headRefName?: string | null;
  baseRefName?: string | null;
  branchHealth?: BranchHealth | null;
  threads?: Thread[] | ThreadWithDisposition[];

  // derived flags (deriveRecord)
  behindBase?: boolean;
  ciFailing?: boolean;
  needsRebase?: boolean;
  readyToMerge?: boolean;
  needsJira?: boolean;
  workerSurfaced?: string;
  ciReran?: boolean;
  outOfSync?: boolean;
  workerError?: string | null;

  // routing/ordering + ephemeral (writeState / SSE overlay)
  sortRank?: number;
  liveStatus?: LiveStatus;
}

/** One flat routing row emitted by placements.placementsFor. */
export interface Placement {
  prKey: string;
  lane: Lane;
  subjectKind: SubjectKind;
  subjectId: string;
  disposition: Disposition;
  reason: string;
  sortRank: number;
}

// ── Sessions (data/sessions.json) ─────────────────────────────────────────────────────

export interface Session {
  id: string;
  createdAt: string;
  interrupted?: boolean;
  lastSeenSha?: string;
}

export type SessionMap = Record<string, Session>;

// ── SSE event payloads (events.mjs) ───────────────────────────────────────────────────

export interface InflightSnapshot {
  inflight: string[];
  rebasing: string[];
}
export interface WorkerStartedEvent extends InflightSnapshot { prKey: string; }
export interface WorkerFinishedEvent extends InflightSnapshot { prKey: string; pending: boolean; }

// ── Config (config.mjs) ───────────────────────────────────────────────────────────────

export interface Config {
  profile: string;
  host: string;
  owner: string;
  login: string;
  port: number;
  pollMinutes: number;
  reenrichFloor: number;
  shutdownGraceMs: number;
  onlyPRs: string[];
  cloneRoot: string;
  gitProtocol: 'ssh' | 'https';
  complianceChecks: string[];
  ignoreChecks: string[];
  jiraPattern: string;
  triggerToken: string;
  debugToken: string;
  workerModel: string;
  workerMaxRetries: number;
  workerSensitivity: number;
  baseDir: string;
}

// ── The wire envelope (state.json), written by server.writeState ──────────────────────

export interface PollError {
  at: string;
  message: string;
}

export interface StateJson {
  updatedAt: string | null;
  scope: string[];
  account?: string | null;
  lanes: Lane[];
  prs: Pr[];
  placements: Placement[];
  lastPollError: PollError | null;
  pollingEnabled: boolean;
  /** Editable + display config for the Settings panel (server.buildSettings). */
  settings?: Record<string, unknown>;
  /** Static sensitivity level descriptors (sensitivity.SENSITIVITY_LEVELS). */
  sensitivityLevels?: unknown;
}
