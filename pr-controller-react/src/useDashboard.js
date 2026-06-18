import { useCallback, useEffect, useRef, useState } from 'react';
import { adaptState } from './adapt.js';

// Central dashboard state + actions.
//
// Two modes:
//  - Live (default): fetches the backend's /state.json, adapts it, polls every
//    60s, and posts user actions to /decision.
//  - Seeded (gallery): pass a `seed` with static sections/threads/jira and
//    skipLoading — no network, used by the Components gallery.
//
// Thread overlay state keyed by thread id:
//   { status: 'pending'|'approved'|'skipped'|'discussing'|'rebutted', rebuttal? }
// JIRA state keyed by PR id: { status: 'set', value }

const POLL_MS = 60000;

async function postDecision(payload) {
  try {
    const r = await fetch('/decision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await r.json();
  } catch {
    return { ok: false };
  }
}

export function useDashboard(seed = null) {
  const seeded = !!seed;

  const [sections, setSections] = useState(seed?.sections || []);
  const [safeMode, setSafeMode] = useState(seed ? seed.mode !== 'live' : true);
  const [openCount, setOpenCount] = useState(seed?.openCount ?? 0);
  const [needCount, setNeedCount] = useState(seed?.needCount ?? 0);

  const [tab, setTab] = useState(seed?.tab || 'needs');
  const [loading, setLoading] = useState(seed?.skipLoading ? false : true);
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState('just now');
  const [toastMsg, setToastMsg] = useState(null);
  const [threads, setThreads] = useState(seed?.threads || {});
  const [jira, setJira] = useState(seed?.jira || {});

  // thread id -> prKey, rebuilt on every fetch so actions can address the backend.
  const threadToPr = useRef(new Map());
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const applyState = useCallback((adapted) => {
    setSections(adapted.sections);
    setSafeMode(adapted.safeMode);
    setOpenCount(adapted.openCount);
    setNeedCount(adapted.needCount);
    const map = new Map();
    for (const s of adapted.sections)
      for (const pr of s.prs) for (const t of pr.threads) map.set(t.id, pr.id);
    threadToPr.current = map;
    setUpdated(adapted.updatedAt ? new Date(adapted.updatedAt).toLocaleTimeString() : 'just now');
  }, []);

  const fetchState = useCallback(async () => {
    if (seeded) return;
    try {
      const r = await fetch('/state.json');
      applyState(adaptState(await r.json()));
    } catch {
      showToast('Could not reach the agent backend');
    }
  }, [seeded, applyState, showToast]);

  // initial load + poll
  useEffect(() => {
    if (seeded) return undefined;
    let alive = true;
    (async () => {
      await fetchState();
      if (alive) setLoading(false);
    })();
    const id = setInterval(fetchState, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [seeded, fetchState]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const setThread = useCallback((id, val) => {
    setThreads((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...val } }));
  }, []);

  const threadStatus = useCallback((id) => threads[id]?.status || 'pending', [threads]);
  const threadRebuttal = useCallback((id) => threads[id]?.rebuttal || '', [threads]);
  const jiraState = useCallback((id) => jira[id] || null, [jira]);

  const approve = useCallback(
    (id) => {
      setThread(id, { status: 'approved' });
      postDecision({ action: 'approve-fix', prKey: threadToPr.current.get(id), threadId: id });
      showToast('Fix approved — applied by the agent');
    },
    [setThread, showToast]
  );

  const skip = useCallback(
    (id) => {
      setThread(id, { status: 'skipped' });
      postDecision({ action: 'skip', prKey: threadToPr.current.get(id), threadId: id });
      showToast('Skipped — left for you');
    },
    [setThread, showToast]
  );

  const discuss = useCallback(
    (id) => {
      setThread(id, { status: 'discussing' });
      postDecision({ action: 'discuss', prKey: threadToPr.current.get(id), threadId: id });
      showToast('Opening a terminal session…');
    },
    [setThread, showToast]
  );

  const undo = useCallback((id) => setThread(id, { status: 'pending', rebuttal: '' }), [setThread]);

  const sendRebuttal = useCallback(
    (id, text) => {
      const v = (text || '').trim();
      if (!v) {
        showToast('Type why you disagree first');
        return false;
      }
      setThread(id, { status: 'rebutted', rebuttal: v });
      postDecision({ action: 'note', prKey: threadToPr.current.get(id), threadId: id, note: v });
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
      postDecision({ action: 'set-jira', prKey: prId, ticket: v });
      showToast('Linked to ' + v);
      return true;
    },
    [showToast]
  );

  const toggleMode = useCallback(() => {
    // Mode is owned by the backend (config.SAFE_MODE). The UI reflects it and
    // can't flip it remotely, so this only explains the current state.
    showToast(
      safeMode
        ? 'Safe mode is set on the backend (config.SAFE_MODE)'
        : 'Live — the agent acts automatically'
    );
  }, [safeMode, showToast]);

  const refresh = useCallback(() => {
    if (seeded) {
      showToast('Up to date');
      return;
    }
    if (refreshing) return;
    setRefreshing(true);
    fetchState().finally(() => {
      setRefreshing(false);
      showToast('Up to date');
    });
  }, [refreshing, seeded, fetchState, showToast]);

  return {
    // mode badge expects 'safe' | 'live'
    mode: safeMode ? 'safe' : 'live',
    tab,
    loading,
    refreshing,
    updated,
    toastMsg,
    setTab,
    sections,
    openCount,
    needCount,
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
