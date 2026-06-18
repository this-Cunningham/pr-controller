import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The Wabi-Sabi design system lives one level up (../design-system) and is the
// single source of truth for look & feel. `@ds` resolves to it so token CSS and
// shared components are imported directly here instead of being duplicated.
const ds = fileURLToPath(new URL('../design-system', import.meta.url));

// Dev server proxies the backend's endpoints to server.mjs (port 4317), so the
// React app can fetch /state.json and POST /decision and /poll during `npm run dev`.
// In production the built dist/ is served directly by server.mjs (same origin),
// so no proxy is needed there.
export default {
  plugins: [react()],
  resolve: { alias: { '@ds': ds } },
  server: {
    // The design system is the single source of truth for look & feel and lives
    // one level up (../design-system). Allow the dev server to read it so token
    // CSS and shared components import directly instead of being duplicated here.
    fs: { allow: ['..'] },
    proxy: {
      '/state.json': 'http://localhost:4317',
      '/decision': 'http://localhost:4317',
      '/poll': 'http://localhost:4317',
    },
  },
  build: { outDir: 'dist' },
};
