// Server-Sent Events hub + the in-flight worker set.
//
// state.json stays the durable snapshot, written at end-of-poll and after each
// per-PR refresh. This channel rides cheap, instantaneous status alongside it:
// the moment a worker launches/exits we push the in-flight prKey set, and a
// `state-updated` nudge tells the client to re-fetch state.json. No polling-
// frequency tradeoff, no deps, native EventSource reconnect.

const subscribers = new Set();   // http response objects with an open SSE stream
const inflight = new Set();      // prKeys with a worker running right now
const rebasing = new Set();      // subset of inflight whose current run IS a rebase

function write(res, event, data) {
  try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
}

function emit(event, data) {
  for (const res of subscribers) write(res, event, data);
}

export function inflightSnapshot() {
  return [...inflight];
}
export function rebasingSnapshot() {
  return [...rebasing];
}

// Register an SSE subscriber. Sends a hello with the current in-flight set so a
// client that connects mid-run immediately knows what's working, then keeps the
// stream open until the request closes.
export function addSubscriber(req, res) {
  subscribers.add(res);
  write(res, 'hello', { inflight: inflightSnapshot(), rebasing: rebasingSnapshot() });
  req.on('close', () => { subscribers.delete(res); });
}

// `opts.rebase` marks this run as a rebase, so the dashboard can say "Rebasing…"
// ONLY when the in-flight worker is actually rebasing (not just any worker on a PR
// that happens to also have a merge conflict).
export function markStarted(prKey, opts = {}) {
  inflight.add(prKey);
  if (opts.rebase) rebasing.add(prKey); else rebasing.delete(prKey);
  emit('worker-started', { prKey, inflight: inflightSnapshot(), rebasing: rebasingSnapshot() });
}

// `opts.pending` (a queued batch runs NEXT) lets the client keep its "dispatched" overlay
// across the gap to the next run — else a still-applying approval flickers back to "Approve".
export function markFinished(prKey, opts = {}) {
  inflight.delete(prKey);
  rebasing.delete(prKey);
  emit('worker-finished', { prKey, pending: !!opts.pending, inflight: inflightSnapshot(), rebasing: rebasingSnapshot() });
}

// Tell every client a fresh state.json is available (after a per-PR refresh).
export function notifyStateUpdated() {
  emit('state-updated', {});
}

export function isInflight(prKey) {
  return inflight.has(prKey);
}
