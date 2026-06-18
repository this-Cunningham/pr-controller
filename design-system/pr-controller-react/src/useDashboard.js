import { useCallback, useEffect, useRef, useState } from 'react';
import { OPEN_COUNT, NEED_COUNT } from './data.js';

// Central dashboard state + actions.
// Thread state overlays the static data, keyed by thread id:
//   { status: 'pending'|'approved'|'skipped'|'discussing'|'rebutted', rebuttal?: string }
// JIRA state keyed by PR id: { status: 'set', value: string }
export function useDashboard(seed = {}) {
  const [mode, setMode] = useState(seed.mode || 'safe'); // 'safe' | 'live'
  const [tab, setTab] = useState(seed.tab || 'needs');
  const [loading, setLoading] = useState(seed.skipLoading ? false : true);
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState('just now');
  const [toastMsg, setToastMsg] = useState(null);
  const [threads, setThreads] = useState(seed.threads || {});
  const [jira, setJira] = useState(seed.jira || {});

  const toastTimer = useRef(null);
  const refreshTimer = useRef(null);

  // first-fetch skeleton
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

  const threadStatus = useCallback((id) => threads[id]?.status || 'pending', [threads]);
  const threadRebuttal = useCallback((id) => threads[id]?.rebuttal || '', [threads]);
  const jiraState = useCallback((id) => jira[id] || null, [jira]);

  const approve = useCallback(
    (id) => {
      setThread(id, { status: 'approved' });
      showToast('Fix approved — applied by the agent');
    },
    [setThread, showToast]
  );

  const skip = useCallback(
    (id) => {
      setThread(id, { status: 'skipped' });
      showToast('Skipped — left for you');
    },
    [setThread, showToast]
  );

  const discuss = useCallback(
    (id) => {
      setThread(id, { status: 'discussing' });
      showToast('Opening a terminal session…');
    },
    [setThread, showToast]
  );

  const undo = useCallback(
    (id) => {
      setThread(id, { status: 'pending', rebuttal: '' });
    },
    [setThread]
  );

  const sendRebuttal = useCallback(
    (id, text) => {
      const v = (text || '').trim();
      if (!v) {
        showToast('Type why you disagree first');
        return false;
      }
      setThread(id, { status: 'rebutted', rebuttal: v });
      showToast('Rebuttal sent to the reviewer');
      return true;
    },
    [setThread, showToast]
  );

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

  const toggleMode = useCallback(() => {
    setMode((m) => {
      const next = m === 'live' ? 'safe' : 'live';
      showToast(
        next === 'live'
          ? 'Live — the agent will act automatically'
          : 'Safe — actions paused, nothing will change'
      );
      return next;
    });
  }, [showToast]);

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
    mode,
    tab,
    loading,
    refreshing,
    updated,
    toastMsg,
    setTab,
    openCount: OPEN_COUNT,
    needCount: NEED_COUNT,
    threadStatus,
    threadRebuttal,
    jiraState,
    approve,
    skip,
    discuss,
    undo,
    sendRebuttal,
    setTicket,
    toggleMode,
    refresh,
  };
}
