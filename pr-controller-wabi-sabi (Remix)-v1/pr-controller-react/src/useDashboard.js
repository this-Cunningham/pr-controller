import { useCallback, useEffect, useRef, useState } from 'react';
import { OPEN_COUNT, NEED_COUNT } from './data.js';

// Central dashboard state + actions.
// Per-thread UI state (overlays the static data), keyed by thread id:
//   { approachStaged?, replySent?, replyText?, terminalOpen? }
// Per-PR branch state, keyed by PR id: { detailsOpen?, terminalOpen? }
// Per-PR runs, keyed by PR id: 'running'
// JIRA state, keyed by PR id: { status: 'set', value }
export function useDashboard(seed = {}) {
  const [scope, setScope] = useState(seed.scope || 'all'); // 'all' | 'scoped'
  const scopeN = seed.scopeN || 3;
  const [tab, setTab] = useState(seed.tab || 'needs');
  const [loading, setLoading] = useState(seed.skipLoading ? false : true);
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState('just now');
  const [toastMsg, setToastMsg] = useState(null);
  const [threads, setThreads] = useState(seed.threads || {});
  const [branch, setBranch] = useState(seed.branch || {});
  const [runs, setRuns] = useState(seed.runs || {});
  const [jira, setJira] = useState(seed.jira || {});

  const toastTimer = useRef(null);
  const refreshTimer = useRef(null);

  useEffect(() => {
    if (seed.skipLoading) return undefined;
    const t = setTimeout(() => setLoading(false), 850);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      clearTimeout(refreshTimer.current);
    },
    []
  );

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const setThread = useCallback((id, val) => {
    setThreads((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...val } }));
  }, []);
  const setBranchState = useCallback((prId, val) => {
    setBranch((prev) => ({ ...prev, [prId]: { ...(prev[prId] || {}), ...val } }));
  }, []);

  // ── getters ──────────────────────────────────────────────
  const approachStaged = useCallback((id) => !!threads[id]?.approachStaged, [threads]);
  const replySent = useCallback((id) => !!threads[id]?.replySent, [threads]);
  const replyText = useCallback((id) => threads[id]?.replyText || '', [threads]);
  const threadTerminalOpen = useCallback((id) => !!threads[id]?.terminalOpen, [threads]);
  const branchDetailsOpen = useCallback((prId) => !!branch[prId]?.detailsOpen, [branch]);
  const branchTerminalOpen = useCallback((prId) => !!branch[prId]?.terminalOpen, [branch]);
  const running = useCallback((prId) => runs[prId] === 'running', [runs]);
  const jiraState = useCallback((id) => jira[id] || null, [jira]);
  const stagedCount = useCallback(
    (prId, prThreads) =>
      (prThreads || []).filter((t) => t.tag === 'input' && t.approach && threads[t.id]?.approachStaged).length,
    [threads]
  );

  // ── needs-your-input thread ──────────────────────────────
  const approveApproach = useCallback(
    (id) => {
      setThread(id, { approachStaged: true });
      showToast('Approach staged — Run agent to carry it out');
    },
    [setThread, showToast]
  );
  const unstageApproach = useCallback((id) => setThread(id, { approachStaged: false }), [setThread]);
  const sendReply = useCallback(
    (id, text) => {
      const v = (text || '').trim();
      if (!v) {
        showToast('Reply can’t be empty');
        return false;
      }
      setThread(id, { replySent: true, replyText: v });
      showToast('Reply sent to the reviewer');
      return true;
    },
    [setThread, showToast]
  );
  const undoReply = useCallback((id) => setThread(id, { replySent: false, replyText: '' }), [setThread]);
  const discuss = useCallback(
    (id) => {
      setThread(id, { terminalOpen: true });
      showToast('Opening a terminal session…');
    },
    [setThread, showToast]
  );

  // ── per-PR staged-approval cart ──────────────────────────
  const runAgent = useCallback(
    (prId, count) => {
      setRuns((prev) => ({ ...prev, [prId]: 'running' }));
      showToast('Running agent — ' + count + ' staged item' + (count === 1 ? '' : 's') + ' queued');
    },
    [showToast]
  );

  // ── branch health ────────────────────────────────────────
  const toggleBranchDetails = useCallback(
    (prId) => setBranch((prev) => ({ ...prev, [prId]: { ...(prev[prId] || {}), detailsOpen: !prev[prId]?.detailsOpen } })),
    []
  );
  const branchTerminal = useCallback(
    (prId) => {
      setBranchState(prId, { terminalOpen: true });
      showToast('Opening a terminal session…');
    },
    [setBranchState, showToast]
  );

  // ── jira ─────────────────────────────────────────────────
  const setTicket = useCallback(
    (prId, value) => {
      const v = (value || '').trim().toUpperCase();
      if (!v) {
        showToast('Enter a ticket key, e.g. ABC-123');
        return false;
      }
      setJira((prev) => ({ ...prev, [prId]: { status: 'set', value: v } }));
      showToast('Linked to ' + v);
      return true;
    },
    [showToast]
  );

  // ── header ───────────────────────────────────────────────
  const toggleScope = useCallback(() => {
    setScope((s) => {
      const next = s === 'all' ? 'scoped' : 'all';
      showToast(next === 'all' ? 'Watching all your open PRs' : 'Scoped to ' + scopeN + ' allowlisted PRs');
      return next;
    });
  }, [showToast, scopeN]);

  const refresh = useCallback(() => {
    setRefreshing((r) => {
      if (r) return r;
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        setRefreshing(false);
        setUpdated('just now');
        showToast('Up to date');
      }, 900);
      return true;
    });
  }, [showToast]);

  return {
    scope,
    scopeN,
    tab,
    loading,
    refreshing,
    updated,
    toastMsg,
    setTab,
    openCount: OPEN_COUNT,
    needCount: NEED_COUNT,
    // getters
    approachStaged,
    replySent,
    replyText,
    threadTerminalOpen,
    branchDetailsOpen,
    branchTerminalOpen,
    running,
    stagedCount,
    jiraState,
    // actions
    approveApproach,
    unstageApproach,
    sendReply,
    undoReply,
    discuss,
    runAgent,
    toggleBranchDetails,
    branchTerminal,
    setTicket,
    toggleScope,
    refresh,
  };
}
