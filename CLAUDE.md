# pr-controller — working notes for Claude

A local Node daemon that watches the user's open GitHub PRs and dispatches headless
Claude workers. **Read [ARCHITECTURE.md](ARCHITECTURE.md) first** — it's the source of
truth for how the system is built. [SPEC.md](SPEC.md) is the behavior spec.

## Load-bearing invariants (don't violate without a deliberate reason)

- **The daemon is server-authoritative for routing.** Which lane an item belongs to is
  decided ONLY in `placements.ts` (`placementsFor` / `LANE_OF_DISPOSITION`). The React
  app FILTERS placements into lanes and renders; it derives no routing. Keep tab/lane
  logic out of the frontend.
- **Pure, tested layers:** `rules.ts`, `derive.ts`, `placements.ts` are pure (no I/O)
  and locked by `test/*.test.ts`. Change behavior → add/adjust a test.
- **Vocabulary:** the per-item verdict is a `disposition` (not `tier`); tabs are `lanes`
  (not `sections`); the design-system short `tag` is styling only. The worker emits a
  `response` (fix/praise/surface); the daemon derives the `disposition`.
- **The design system is frozen** (baseline bundled at
  `design/.upstream/pr-controller-prototypes/_ds/wabi-sabi-design-system-*/`
  + the vendored `pr-controller-react/src/design-system/`): components render, they
  don't route; don't restyle ad hoc. Sync it only via `/pull-new-designs` (see
  `.design-sync.json` for the project→baseline→app mapping).

## Running it

- **TypeScript:** the daemon is `.ts` run via **tsx** (no build step — `tsx` strips types at
  load); the dashboard is `.ts`/`.tsx` built by Vite. Canonical pipeline types live once in
  `types.ts` (daemon) mirrored by `pr-controller-react/src/features/dashboard/wire.ts` (the
  browser can't import across the repo root) — keep the two in lockstep. The frozen
  design-system + prototype-synced feature components stay `.jsx` (typed via their `.d.ts`).
- Tests: `node --import tsx --test "test/**/*.test.ts"` (or `npm test`).
- Typecheck: `npm run typecheck` (daemon, `tsc --noEmit`) + `cd pr-controller-react && yarn typecheck`.
- Dashboard build: `cd pr-controller-react && yarn build` (server serves `dist/`). The Vite
  `resolve-ts-from-js` plugin lets frozen `.jsx` import app logic by its `.js`/`.jsx` specifier.
- Design-system adherence lint: `cd pr-controller-react && yarn lint` — enforces token
  hygiene (no raw hex/px, design-system fonts only) + per-component prop/tone contracts,
  vendored from the foundation's `_adherence.oxlintrc.json` (run as ESLint; see
  `eslint.config.js`).
- Daemon: `node --import tsx server.ts` (or `npm start`) — env-overridable via `PRC_*` (see `config.ts` /
  ARCHITECTURE.md). Workers spawn real `claude -p` and push to real PRs;
  `config.onlyPRs` is the scope primitive + circuit-breaker.

## Keep fixes localized

Each concern has one home: routing in `placements.ts`, per-thread verdicts in
`rules.ts`, the canonical record in `derive.ts`, the worker prompt in `prompt.ts`
(`assembleWorkerPrompt` — the worker renders it and the Prompt-tracer mirrors it; the
React `PromptTracer` only renders), lane composition + rendering in `adapt.ts`/`PRCard`.
A routing fix is one change in `placements.ts` + a test; a worker fix stays in the worker
layer. If a fix starts spreading across layers, stop and reconsider — keeping each concern
in one home is what keeps the system maintainable.
