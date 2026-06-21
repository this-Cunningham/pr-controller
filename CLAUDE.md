# pr-controller — working notes for Claude

A local Node daemon that watches the user's open GitHub PRs and dispatches headless
Claude workers. **Read [ARCHITECTURE.md](ARCHITECTURE.md) first** — it's the source of
truth for how the system is built. [SPEC.md](SPEC.md) is the behavior spec.

## Load-bearing invariants (don't violate without a deliberate reason)

- **The daemon is server-authoritative for routing.** Which lane an item belongs to is
  decided ONLY in `placements.mjs` (`placementsFor` / `LANE_OF_DISPOSITION`). The React
  app FILTERS placements into lanes and renders; it derives no routing. Keep tab/lane
  logic out of the frontend.
- **Pure, tested layers:** `rules.mjs`, `derive.mjs`, `placements.mjs` are pure (no I/O)
  and locked by `test/*.test.mjs`. Change behavior → add/adjust a test.
- **Vocabulary:** the per-item verdict is a `disposition` (not `tier`); tabs are `lanes`
  (not `sections`); the design-system short `tag` is styling only. The worker emits a
  `response` (fix/praise/surface); the daemon derives the `disposition`.
- **The design system is frozen** (baseline `design/.upstream/wabi-sabi-foundation/`
  + the vendored `pr-controller-react/src/design-system/`): components render, they
  don't route; don't restyle ad hoc. Sync it only via `/pull-new-designs` (see
  `.design-sync.json` for the project→baseline→app mapping).

## Running it

- Tests: `node --test "test/**/*.test.mjs"`
- Dashboard build: `cd pr-controller-react && yarn build` (server serves `dist/`).
- Design-system adherence lint: `cd pr-controller-react && yarn lint` — enforces token
  hygiene (no raw hex/px, design-system fonts only) + per-component prop/tone contracts,
  vendored from the foundation's `_adherence.oxlintrc.json` (run as ESLint; see
  `eslint.config.js`).
- Daemon: `node server.mjs` — env-overridable via `PRC_*` (see `config.mjs` /
  ARCHITECTURE.md). Workers spawn real `claude -p` and push to real PRs;
  `config.onlyPRs` is the scope primitive + circuit-breaker.

## Keep fixes localized

Each concern has one home: routing in `placements.mjs`, per-thread verdicts in
`rules.mjs`, the canonical record in `derive.mjs`, lane composition + rendering in
`adapt.js`/`PRCard`. A routing fix is one change in `placements.mjs` + a test; a worker
fix stays in the worker layer. If a fix starts spreading across layers, stop and
reconsider — keeping each concern in one home is what keeps the system maintainable.
