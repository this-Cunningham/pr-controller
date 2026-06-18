// Server-Sent Events hub + the in-flight worker set.
//
// state.json stays the durable snapshot, written at end-of-poll and after each
// per-PR refresh. This channel rides cheap, instantaneous status alongside it:
// the moment a worker launches/exits we push the in-flight prKey set, and a
// `state-updated` nudge tells the client to re-fetch state.json. No polling-
// frequency tradeoff, no deps, native EventSource reconnect.

const subscribers = new Set();   // http response objects with an open SSE stream
const inflight = new Set();      // prKeys with a worker running right now

function write(res, event, data) {
  try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
}

function emit(event, data) {
  for (const res of subscribers) write(res, event, data);
}

export function inflightSnapshot() {
  return [...inflight];
}

// Register an SSE subscriber. Sends a hello with the current in-flight set so a
// client that connects mid-run immediately knows what's working, then keeps the
// stream open until the request closes.
export function addSubscriber(req, res) {
  subscribers.add(res);
  write(res, 'hello', { inflight: inflightSnapshot() });
  req.on('close', () => { subscribers.delete(res); });
}

export function markStarted(prKey) {
  inflight.add(prKey);
  emit('worker-started', { prKey, inflight: inflightSnapshot() });
}

export function markFinished(prKey) {
  inflight.delete(prKey);
  emit('worker-finished', { prKey, inflight: inflightSnapshot() });
}

// Tell every client a fresh state.json is available (after a per-PR refresh).
export function notifyStateUpdated() {
  emit('state-updated', {});
}

export function isInflight(prKey) {
  return inflight.has(prKey);
}
