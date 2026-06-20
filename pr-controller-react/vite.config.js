import react from '@vitejs/plugin-react';

// Dev server proxies the backend's endpoints to server.mjs (port 4317), so the
// React app can fetch /state.json and POST /decision and /poll during `npm run dev`.
// In production the built dist/ is served directly by server.mjs (same origin),
// so no proxy is needed there.
//
// The Wabi-Sabi design system is vendored into the app (src/design-system/) and
// imported with normal relative paths — no alias or out-of-root file access.
export default {
  plugins: [react()],
  server: {
    proxy: {
      '/state.json': 'http://localhost:4317',
      '/decision': 'http://localhost:4317',
      '/poll': 'http://localhost:4317',
      // SSE live-status channel. Without this, worker-started/finished and the
      // state-updated nudge are silently dead in `npm run dev` and the UI
      // degrades to the 60s poll with no error. ws:false — it's an EventSource
      // (plain HTTP stream), not a websocket.
      '/events': { target: 'http://localhost:4317', ws: false },
    },
  },
  build: { outDir: 'dist' },
};
