// Bridges the vendored design-system's `PRController` interface (see
// design-system/components/pr/ThreadRow.d.ts) onto our dashboard hook (`dash`).
// The DS components are brand/source-of-truth and must stay unmodified, so this is
// the ONLY place that knows both vocabularies. Thread-keyed methods resolve their
// owning PR via dash.threadToPr; PR-keyed methods take prId directly.

export function makeController(dash) {
  const prOf = (threadId) => dash.threadToPr.current.get(threadId);

  return {
    // ----- needs-your-input thread -----
    approachStaged: (id) => dash.isStaged(prOf(id), id),
    approveApproach: (id) => dash.stageApproach(prOf(id), id),
    unstageApproach: (id) => dash.unstageApproach(prOf(id), id),
    replySent: (id) => dash.threadStatus(id) === 'rebutted',
    replyText: (id) => dash.threadRebuttal(id),
    sendReply: (id, text) => dash.sendRebuttal(id, text),
    undoReply: (id) => dash.undoReply(id),
    discuss: (id) => dash.discuss(id),
    threadTerminalOpen: (id) => dash.threadStatus(id) === 'discussing',

    // ----- per-PR staged-approval cart -----
    stagedCount: (prId) => dash.stagedFor(prId).length,
    running: (prId) => dash.prWorking(prId),
    runAgent: (prId) => dash.runAgent(prId),

    // ----- branch health -----
    branchDetailsOpen: (prId) => dash.branchDetailsOpen(prId),
    toggleBranchDetails: (prId) => dash.toggleBranchDetails(prId),
    branchTerminalOpen: (prId) => dash.branchHealthStatus(prId) === 'discussing',
    branchTerminal: (prId) => dash.discussRebase(prId),

    // ----- jira -----
    jiraValue: (prId) => dash.jiraState(prId)?.value || null,
    setTicket: (prId, value) => dash.setTicket(prId, value),
  };
}
