import react from '@vitejs/plugin-react';

// Dev server proxies the backend's endpoints to server.mjs (port 4317), so the
// React app can fetch /state.json and POST /decision and /poll during `npm run dev`.
// In production the built dist/ is served directly by server.mjs (same origin),
// so no proxy is needed there.
export default {
  plugins: [react()],
  server: {
    proxy: {
      '/state.json': 'http://localhost:4317',
      '/decision': 'http://localhost:4317',
      '/poll': 'http://localhost:4317',
    },
  },
  build: { outDir: 'dist' },
};
