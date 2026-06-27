import react from '@vitejs/plugin-react';

// Dev server proxies the backend's endpoints to server.mjs (port 4317), so the
// React app can fetch /state.json and POST /decision and /poll during `npm run dev`.
// In production the built dist/ is served directly by server.mjs (same origin),
// so no proxy is needed there.
//
// The Wabi-Sabi design system is vendored into the app (src/design-system/) and
// imported with normal relative paths — no alias or out-of-root file access.
// The app-authored logic (useDashboard, cardProps, adapt) and SwimlaneBoard migrated to
// .ts/.tsx, but the frozen, prototype-synced components (e.g. App.jsx) import them with the
// TypeScript ".js"/".jsx" specifier convention (`import './useDashboard.js'`). tsc and tsx
// resolve those to the .ts/.tsx source; Rollup (vite build) does NOT. This resolver closes
// that gap WITHOUT editing any frozen .jsx: a relative import ending in .js/.jsx whose
// literal file is absent falls through to its .ts/.tsx sibling (else default resolution).
const resolveTsFromJs = {
  name: 'resolve-ts-from-js',
  async resolveId(source, importer, options) {
    if (!importer || !(source.startsWith('./') || source.startsWith('../'))) return null;
    const remap = source.endsWith('.jsx') ? source.slice(0, -4) + '.tsx'
      : source.endsWith('.js') ? source.slice(0, -3) + '.ts'
      : null;
    if (!remap) return null;
    const resolved = await this.resolve(remap, importer, { ...options, skipSelf: true });
    return resolved || null;
  },
};

export default {
  plugins: [resolveTsFromJs, react()],
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
