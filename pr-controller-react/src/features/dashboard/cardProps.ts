// Map the dashboard state hook (useDashboard) to the plain props each card + thread
// renders from. These are "derive props from state" builders called at the render site
// in App's Dashboard — the RETURNED props (data + onX callbacks) are spread onto the
// presentational PRCard / ThreadRow. Nothing here is threaded down as a state object;
// the components never see `dash`.

import type { DashApi } from './useDashboard.ts';
import type { PRCardItem, PRCardProps } from './PRCard';
import type { ThreadRowProps } from './ThreadRow';

/** The data + handler props cardProps spreads onto <PRCard> (everything except the
 *  routing-owned `pr`/`lane`/`items`). */
type CardDataProps = Pick<
  PRCardProps,
  | 'stagedCount'
  | 'running'
  | 'onRunAgent'
  | 'branchDetailsOpen'
  | 'onToggleBranchDetails'
  | 'branchTerminalOpen'
  | 'onBranchTerminal'
  | 'onBranchRerun'
  | 'jiraLinked'
  | 'onSetTicket'
>;

/** The per-thread data + handler props (everything <ThreadRow> needs except `thread`). */
type ThreadDataProps = Omit<ThreadRowProps, 'thread'>;

// PR-level data + handlers for one card, bound to its "repo#number" id.
export function cardProps(dash: DashApi, prId: string): CardDataProps {
  return {
    stagedCount: dash.stagedFor(prId).length,
    running: dash.prWorking(prId),
    onRunAgent: () => dash.runAgent(prId),
    branchDetailsOpen: dash.branchDetailsOpen(prId),
    onToggleBranchDetails: () => dash.toggleBranchDetails(prId),
    branchTerminalOpen: dash.branchHealthStatus(prId) === 'discussing',
    // `kind` (conflict/outOfSync/workerFailed) selects the terminal opener; discussRebase defaults it to 'rebase'.
    onBranchTerminal: (kind?: string) => dash.discussRebase(prId, kind),
    onBranchRerun: () => dash.rerunBranch(prId),
    jiraLinked: dash.jiraState(prId)?.value || null,
    onSetTicket: (value: string) => dash.setTicket(prId, value),
  };
}

// Attach each thread item's presentational props (data + handlers, bound to this PR +
// thread) so PRCard/ThreadRow stay pure renderers — they never touch the state hook.
// Shared by the dashboard list view and the swimlane board's expand modal.
export function wireItems(dash: DashApi, prId: string, items: PRCardItem[]): PRCardItem[] {
  return items.map((it) =>
    it.kind === 'thread'
      ? { ...it, threadProps: threadProps(dash, prId, it.thread.id) }
      : it
  );
}

// Per-thread data + handlers, bound to one (prId, threadId). The card knows both ids
// (it renders the thread inside the PR), so no thread->PR lookup is needed.
export function threadProps(dash: DashApi, prId: string, threadId: string): ThreadDataProps {
  return {
    staged: dash.isStaged(prId, threadId),
    replySent: dash.threadStatus(threadId) === 'rebutted',
    sentReplyText: dash.threadRebuttal(threadId),
    terminalOpen: dash.threadStatus(threadId) === 'discussing',
    onApprove: () => dash.stageApproach(prId, threadId),
    onUnstage: () => dash.unstageApproach(prId, threadId),
    onSendReply: (text: string) => dash.sendRebuttal(threadId, text),
    onUndoReply: () => dash.undoReply(threadId),
    onDiscuss: () => dash.discuss(threadId),
  };
}
