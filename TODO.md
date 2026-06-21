# TODO

- [ ] make sure worktrees cleaned up after pr merged
- [ ] the "Agent surfaced" banner (e.g. the long mach5-validate/m5-base-behind-main explanation in the Needs you lane) is a complicated way of saying we need to rebase -- be more direct/simple, maybe just a "needs rebase" tag
- [ ] "agent surfaced" copy can be very lengthy -- can we get a TLDR version with option to "expand" where we would get this current copy after expanding
- [ ] look into polishing the prompts we inject into our workers, the initial prompt but then also eventual prompts that are injected mid session
- [ ] add config slider that adjusts the "surface this to me" sensitivity of the workers. (maybe some users will want their workers to surface more things. some users will want their workers to handle everything (except aborted complicated rebases)) this slider would change the prompts that the workers get when going over PRs
- [ ] add my new loading indicators from claude design
- [ ] can we make the threads clickable that go to the comment/thread in github?
- [ ] is it hard to surface the diff from the threads in our app?
- [ ] bug that double renders the agent reasoning on the cards -- the only one that should show up is the one that renders after the user decides to show it.  the static "always rendered" one can be removed
- [ ] `pull-new-designs` skill: on a full design-system-first import, PORT the usage intent into the app instead of leaving it baseline-only — merge the shipped `_adherence.oxlintrc.json` into the repo's lint, vendor the design system's `readme.md` usage guidance into a `design-system/README.md` (or CLAUDE.md), and fold any per-component `*.prompt.md` docs into component JSDoc.
- [ ] Daemon crash: `recordDecision()` in `server.mjs` writes `data/decisions.json` without mkdir-ing `data/` first. When the first poll never succeeds (e.g. GitHub unreachable at startup), `writeState()` never runs, so `data/` is never created — then the first `POST /decision` throws an unhandled ENOENT inside the `req.on('end')` async handler and crashes the whole daemon. Fix: `await mkdir(DATA, { recursive: true })` in `recordDecision` before the writeFile (or guard the write). The normal path masks it because a successful first poll creates `data/`.

## Ingestion hardening (do before emptying `config.onlyPRs` / going past the 3 sandbox PRs)
These touch the live `gh` API path — smoke-test against real PRs, not blind.

- [ ] batch the per-PR GraphQL fan-out in `scanner.mjs` (`scanAll` makes one `fetchThreads` call per PR, sequentially) into 1–2 aliased / `nodes(ids:[...])` queries, so N PRs cost ~1 call and stay under GraphQL secondary limits
- [ ] `refreshOnePR` re-runs a full `listOpenPRs()` (`gh search prs`) on every worker exit just to re-find one PR — fetch that single PR by direct node lookup instead, so worker-heavy periods don't drain the tightest-limit search bucket
- [ ] `updatedAt` change-filter: skip re-enriching PRs whose `updatedAt` is unchanged since last poll (cheap; big win on the all-PRs path). Keep a periodic full re-derive as a floor — `updatedAt` is lossy for CI flips / thread resolves
- [ ] detect 403 / 429 + `X-RateLimit` headers and back off explicitly, instead of collapsing a throttle into an indistinguishable `{error}` thread that `poll()` silently swallows
- [ ] (optional) freshness indicator: track per-PR `scannedAt` / a top-level `githubAsOf` + `stale` flag and show it in the header, so the UI distinguishes "agent working now" (live) from "GitHub data as of HH:MM" (poll-fresh)
