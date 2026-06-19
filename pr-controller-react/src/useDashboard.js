import { useCallback, useEffect, useRef, useState } from 'react';
import { adaptState } from './adapt.js';
import { MOCK_STATE } from './mockState.js';

// `?mock` (or `?mock=1`) loads a static state.json-shaped fixture through the
// real adaptState pipeline instead of hitting the backend — for validating every
// design state without a live PR. No network, no SSE.
const MOCK = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mock');

// Central dashboard state + actions.
//
// Two modes:
//  - Live (default): fetches the backend's /state.json, adapts it, polls every
//    60s, and posts user actions to /decision.
//  - Seeded (gallery): pass a `seed` with static sections/threads/jira and
//    skipLoading — no network, used by the Components gallery.
//
// Thread overlay state keyed by thread id:
//   { status: 'pending'|'discussing'|'rebutted', rebuttal? }
// agree-fix threads are auto-handled by the backend poller; the UI only drives the
// human-intervention threads (hash-out -> discuss/rebut, error -> discuss).
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
  // scope = config.onlyPRs: [] means all PRs (full production), a list means the
  // daemon is restricted to those PR keys. The worker always acts on what it sees.
  const [scope, setScope] = useState(seed?.scope || []);
  const [openCount, setOpenCount] = useState(seed?.openCount ?? 0);
  const [needCount, setNeedCount] = useState(seed?.needCount ?? 0);

  const [tab, setTab] = useState(seed?.tab || 'needs');
  const [loading, setLoading] = useState(seed?.skipLoading ? false : true);
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState('just now');
  const [toastMsg, setToastMsg] = useState(null);
  const [threads, setThreads] = useState(seed?.threads || {});
  const [jira, setJira] = useState(seed?.jira || {});
  // prKeys with a worker running right now (from the SSE in-flight set).
  const [workingPRs, setWorkingPRs] = useState(() => new Set(seed?.workingPRs || []));
  // prId -> Set<threadId> the user has approved but not yet dispatched ("cart").
  const [staged, setStaged] = useState({});
  // prId -> threadId[] that were sent to the agent and are being applied right
  // now. Distinct from `staged`: once "Run agent" fires, a thread leaves the cart
  // but must NOT fall back to showing "Approve" — it's in flight. Cleared when the
  // PR's worker finishes (the refreshed state then reflects the real outcome).
  const [dispatched, setDispatched] = useState({});

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
    setScope(adapted.scope);
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
    if (MOCK) { applyState(adaptState(MOCK_STATE)); return; }
    try {
      const r = await fetch('/state.json');
      applyState(adaptState(await r.json()));
    } catch {
      showToast('Could not reach the agent backend');
    }
  }, [seeded, applyState, showToast]);

  // initial load + poll + live status (SSE)
  useEffect(() => {
    if (seeded) return undefined;
    let alive = true;
    (async () => {
      await fetchState();
      if (alive) setLoading(false);
    })();
    // Mock mode is static — no polling, no SSE (there's no backend).
    if (MOCK) return () => { alive = false; };
    // 60s poll stays as a fallback when the SSE stream is unavailable.
    const id = setInterval(fetchState, POLL_MS);

    // Live channel: worker-started/finished carry the in-flight prKey set so the
    // "agent working…" badge appears the instant a worker launches; state-updated
    // nudges a fresh /state.json fetch after a per-PR refresh.
    let es;
    try {
      es = new EventSource('/events');
      const onInflight = (e) => {
        try { setWorkingPRs(new Set(JSON.parse(e.data).inflight || [])); } catch {}
      };
      es.addEventListener('hello', onInflight);
      es.addEventListener('worker-started', onInflight);
      es.addEventListener('worker-finished', (e) => {
        onInflight(e);
        // The worker for this PR finished applying — clear its in-flight approvals
        // so the (now refreshed) thread state drives the UI, not the stale marker.
        try {
          const { prKey } = JSON.parse(e.data);
          if (prKey) setDispatched((prev) => { const n = { ...prev }; delete n[prKey]; return n; });
        } catch {}
      });
      es.addEventListener('state-updated', () => fetchState());
    } catch {}

    return () => {
      alive = false;
      clearInterval(id);
      if (es) es.close();
    };
  }, [seeded, fetchState]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const setThread = useCallback((id, val) => {
    setThreads((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...val } }));
  }, []);

  const threadStatus = useCallback((id) => threads[id]?.status || 'pending', [threads]);
  const threadRebuttal = useCallback((id) => threads[id]?.rebuttal || '', [threads]);
  const jiraState = useCallback((id) => jira[id] || null, [jira]);
  const prWorking = useCallback((prId) => workingPRs.has(prId), [workingPRs]);
  const stagedFor = useCallback((prId) => staged[prId] || [], [staged]);
  const isStaged = useCallback((prId, threadId) => (staged[prId] || []).includes(threadId), [staged]);
  // A thread is "dispatched" once Run agent sends it and until the worker finishes.
  const isDispatched = useCallback(
    (prId, threadId) => (dispatched[prId] || []).includes(threadId),
    [dispatched]
  );

  // Phase 2: approving an approach STAGES it locally (a per-PR cart) — it does
  // NOT dispatch. "Run agent (N)" below sends the whole cart in one resumed worker.
  const stageApproach = useCallback((prId, threadId) => {
    setStaged((prev) => {
      const cur = prev[prId] || [];
      if (cur.includes(threadId)) return prev;
      return { ...prev, [prId]: [...cur, threadId] };
    });
  }, []);

  const runAgent = useCallback(
    async (prId) => {
      const threadIds = staged[prId] || [];
      if (!threadIds.length) return;
      showToast('Dispatching the agent…');
      const res = await postDecision({ action: 'run-agent', prKey: prId, threadIds });
      if (res?.spawn?.spawned) {
        // Move from cart -> in-flight: empties the "Run agent (N)" cart but keeps
        // these threads marked as applying (so they don't revert to "Approve").
        setStaged((prev) => { const n = { ...prev }; delete n[prId]; return n; });
        setDispatched((prev) => ({ ...prev, [prId]: [...(prev[prId] || []), ...threadIds] }));
        showToast(res.spawn.queued ? 'Agent busy — queued for the next run' : 'Agent dispatched');
      } else {
        showToast(res?.spawn?.reason || 'Could not dispatch the agent');
      }
    },
    [staged, showToast]
  );

  // Manual "Rebase" CTA: the branch has a merge conflict and nothing else was
  // queued, so the agent didn't auto-rebase. Dispatch one on demand.
  const rebasePR = useCallback(
    async (prId) => {
      showToast('Dispatching the rebase…');
      const res = await postDecision({ action: 'rebase', prKey: prId });
      if (res?.spawn?.spawned) {
        showToast(res.spawn.queued ? 'Agent busy — rebase queued for the next run' : 'Rebase dispatched');
      } else {
        showToast(res?.spawn?.reason || 'Could not dispatch the rebase');
      }
    },
    [showToast]
  );

  // Branch-health discuss: the agent already TRIED the rebase and surfaced it as
  // too risky to do mechanically, so re-dispatching would just bail again. Open an
  // interactive terminal in the worktree to resolve it by hand instead. No threadId.
  const discussRebase = useCallback(
    async (prId) => {
      // Show the "›_ Terminal session opened…" note in the card immediately on
      // click (same instant feedback as the thread-level Discuss). Branch-health
      // has no threadId, so we key the overlay by the PR id itself. Revert only
      // if a real dispatch fails.
      setThread(prId, { status: 'discussing' });
      showToast('Opening a terminal session…');
      if (seeded) return;
      const res = await postDecision({ action: 'discuss', prKey: prId });
      if (!res?.spawn?.spawned) {
        setThread(prId, { status: 'pending' });
        showToast(res?.spawn?.reason || 'Could not open a terminal session');
      }
    },
    [seeded, setThread, showToast]
  );

  const discuss = useCallback(
    async (id) => {
      // Show the "›_ Terminal session opened…" note immediately on click (instant
      // feedback, matching the design system) rather than waiting for the backend
      // round-trip. Revert only if a real dispatch actually fails.
      setThread(id, { status: 'discussing' });
      showToast('Opening a terminal session…');
      if (seeded) return;
      const res = await postDecision({
        action: 'discuss',
        prKey: threadToPr.current.get(id),
        threadId: id,
      });
      if (!res?.spawn?.spawned) {
        setThread(id, { status: 'pending' });
        showToast(res?.spawn?.reason || 'Could not open a terminal session');
      }
    },
    [seeded, setThread, showToast]
  );

  const sendRebuttal = useCallback(
    (id, text) => {
      const v = (text || '').trim();
      if (!v) {
        showToast('Type your reply to the reviewer first');
        return false;
      }
      setThread(id, { status: 'rebutted', rebuttal: v });
      showToast('Posting your rebuttal…');
      postDecision({ action: 'note', prKey: threadToPr.current.get(id), threadId: id, note: v }).then((res) => {
        if (res?.spawn?.spawned) showToast('Rebuttal posted to the reviewer');
        else {
          setThread(id, { status: 'pending', rebuttal: '' });
          showToast(res?.spawn?.reason || 'Could not post the rebuttal');
        }
      });
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

  const explainScope = useCallback(() => {
    // Scope is owned by the backend (config.onlyPRs). The UI reflects it and
    // can't change it remotely, so this only explains the current state.
    showToast(
      scope.length
        ? `Scoped to ${scope.join(', ')} — other PRs are not touched (config.onlyPRs)`
        : 'Live on all your open PRs — the agent acts automatically (config.onlyPRs)'
    );
  }, [scope, showToast]);

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

  // TEMP (debug): trigger a backend poll instead of waiting the 30-min timer.
  // Fire-and-forget on the server; we re-fetch state a few seconds later.
  const runPoll = useCallback(async () => {
    if (seeded) return;
    showToast('Running a poll…');
    try {
      const res = await fetch('/poll', { method: 'POST' });
      const r = await res.json();
      showToast(r?.started ? 'Poll started — refreshing shortly' : 'A poll is already running');
      setTimeout(fetchState, 4000);
    } catch {
      showToast('Could not reach the agent backend');
    }
  }, [seeded, fetchState, showToast]);

  return {
    // scope badge: [] = live on all PRs, a list = restricted to those PR keys
    scope,
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
    prWorking,
    stagedFor,
    isStaged,
    isDispatched,
    stageApproach,
    runAgent,
    rebasePR,
    discussRebase,
    discuss,
    sendRebuttal,
    setTicket,
    explainScope,
    refresh,
    runPoll,
  };
}
