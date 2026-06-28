// Frontend mirror of the daemon's state.json wire contract (the daemon's authoritative
// copy is /types.ts at the repo root). The app must NOT import that file directly — Vite
// bundles this for the browser and /types.ts pulls node-only types. ARCHITECTURE.md's
// state.json block is the conceptual source both sides track; keep these in lockstep.

export type Lane = 'needs' | 'progress' | 'waiting';

export type Disposition =
  | 'needsYourApproval'
  | 'agentError'
  | 'notYetReviewed'
  | 'agentAutoFixed'
  | 'awaitingReviewer'
  | 'agentAcknowledged'
  | 'jiraNeeded'
  | 'workerFailed'
  | 'branchOutOfSync'
  | 'branchConflict'
  | 'agentWorking';

export type SubjectKind = 'thread' | 'jira' | 'branch' | 'live';

/** Design-system short tag (styling only). */
export type Tag = 'input' | 'fixed' | 'waiting' | 'pending' | 'praise' | 'error';

/** One agent-drafted approach (multi-approach variant). Mirror of types.ts Approach —
 *  keep in lockstep. The worker does not emit these yet; the contract is here so the
 *  ThreadRow multi-approach UI is reachable the moment the daemon does. */
export interface Approach {
  title: string;
  body: string;
  trade?: string;
  reply?: string;
}

export type LiveStatus = 'working' | 'rebasing';

export interface Check {
  name: string;
  state: string;
  url?: string | null;
}

export interface BranchHealth {
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
  mergeState: string | null;
  checkState: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR' | 'EXPECTED' | null;
  failingChecks: Check[];
  complianceChecks: Check[];
}

/** A thread as it arrives on the wire (after the daemon derived its disposition). */
export interface WireThread {
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
  disposition?: Disposition;
  reason?: string;
  suggestedReply?: string;
  suggestedApproach?: string;
  /** Multi-approach alternatives (supersede `suggestedApproach` when present). */
  approaches?: Approach[];
  error?: string;
  /** Set on a scan-error stub; the daemon emits it (root types.ts Thread) and adapt reads it
   *  to build the scan-error caption. Mirror of Thread.errorKind — keep in lockstep. */
  errorKind?: 'rateLimit' | 'auth' | 'forbidden' | 'graphql' | 'other';
}

/** A PR record as it arrives on the wire (server.writeState). */
export interface WirePr {
  number: number;
  title: string;
  repo: string;
  nameWithOwner: string;
  url: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  reviewDecision?: string | null;
  headRefName?: string | null;
  baseRefName?: string | null;
  branchHealth?: BranchHealth | null;
  threads?: WireThread[];
  behindBase?: boolean;
  ciFailing?: boolean;
  needsRebase?: boolean;
  readyToMerge?: boolean;
  needsJira?: boolean;
  workerSurfaced?: string;
  ciReran?: boolean;
  outOfSync?: boolean;
  workerError?: string | null;
  sortRank?: number;
  liveStatus?: LiveStatus;
}

/** One flat routing row (placements.placementsFor). */
export interface Placement {
  prKey: string;
  lane: Lane;
  subjectKind: SubjectKind;
  subjectId: string;
  disposition: Disposition;
  reason: string;
  sortRank: number;
}

export interface PollError {
  at: string;
  message: string;
}

/** The full state.json envelope. */
export interface StateJson {
  updatedAt: string | null;
  scope: string[];
  account?: string | null;
  lanes: Lane[];
  prs: WirePr[];
  placements: Placement[];
  lastPollError: PollError | null;
  pollingEnabled: boolean;
  settings?: Record<string, unknown>;
  sensitivityLevels?: unknown;
}
