# TODO

- [ ] make sure worktrees cleaned up after pr merged
- [ ] dont render the div with styles.reasonFull if thread.reasonFull is missing -- also we should look into if our agents are not returning "reasonFull" consistently
- [ ] look into polishing the prompts we inject into our workers, the initial prompt but then also eventual prompts that are injected mid session
- [ ] `pull-new-designs` skill: on a full design-system-first import, PORT the usage intent into the app instead of leaving it baseline-only — merge the shipped `_adherence.oxlintrc.json` into the repo's lint, vendor the design system's `readme.md` usage guidance into a `design-system/README.md` (or CLAUDE.md).
- [ ] Daemon crash: `recordDecision()` in `server.mjs` writes `data/decisions.json` without mkdir-ing `data/` first. When the first poll never succeeds (e.g. GitHub unreachable at startup), `writeState()` never runs, so `data/` is never created — then the first `POST /decision` throws an unhandled ENOENT inside the `req.on('end')` async handler and crashes the whole daemon. Fix: `await mkdir(DATA, { recursive: true })` in `recordDecision` before the writeFile (or guard the write). The normal path masks it because a successful first poll creates `data/`.
- [ ] should the workers respond with structured output? or is this too complicated to integrate?
- [ ] audit our observability of the stack -- should it be ripped out and replaced? how can it be improved?
- [ ] our `pull-new-designs` skill may be causing us to build our react components in the live app with weird `dc.html` patterns instead of using react best practices -- example: we pass "controller" as a prop a bunch, see: `pr-controller-react/src/features/dashboard/App.jsx`, we even have `pr-controller-react/src/features/dashboard/controller.js` .. this seems SUPER odd. `pr-controller-react/src/features/dashboard/JiraBanner.jsx`. there are multiple examples of this -- the `pull-new-designs` should NOT instruct any implementations to be like this, it should be normal clean react best practices -- the controller is really part of the claude design runtime for previewing prototypes

## Ingestion hardening (do before emptying `config.onlyPRs` / going past the 3 sandbox PRs)
These touch the live `gh` API path — smoke-test against real PRs, not blind.

- [ ] batch the per-PR GraphQL fan-out in `scanner.mjs` (`scanAll` makes one `fetchThreads` call per PR, sequentially) into 1–2 aliased / `nodes(ids:[...])` queries, so N PRs cost ~1 call and stay under GraphQL secondary limits
- [ ] `refreshOnePR` re-runs a full `listOpenPRs()` (`gh search prs`) on every worker exit just to re-find one PR — fetch that single PR by direct node lookup instead, so worker-heavy periods don't drain the tightest-limit search bucket
- [ ] `updatedAt` change-filter: skip re-enriching PRs whose `updatedAt` is unchanged since last poll (cheap; big win on the all-PRs path). Keep a periodic full re-derive as a floor — `updatedAt` is lossy for CI flips / thread resolves
- [ ] detect 403 / 429 + `X-RateLimit` headers and back off explicitly, instead of collapsing a throttle into an indistinguishable `{error}` thread that `poll()` silently swallows