# TODO

- [ ] make sure worktrees cleaned up after pr merged
- [x] after worker ran on the PR and fixed issue + resolved threads -- the PR / threads still appear in "auto-handling" (maybe other tabs if it were to show up there) — fixed: server.mjs now (a) only honors a `surfaced` rebase while the branch still actually conflicts (no stale pin), and (b) unlinks the stale `worker-<repo>-<num>.json` once none of its actions match a live thread and the branch is clean.
- [ ] the "Agent surfaced" banner (e.g. the long mach5-validate/m5-base-behind-main explanation in the Needs you lane) is a complicated way of saying we need to rebase -- be more direct/simple, maybe just a "needs rebase" tag
- [x] waiting to rebase until all approved may be a bad idea since it will dismiss their reviews -- now: rebase folds into any feedback/CI worker run on conflict; if there's nothing else to do, a manual "Rebase" CTA appears (no quiet force-push). No longer approval-gated.
- [x] Integrate the incoming design system into the dashboard — done: the Wabi-Sabi design system is vendored into pr-controller-react (CSS modules + tokens) and the theme is frozen; adapt.js maps dispositions to the DS tag vocabulary.
- [ ] "agent surfaced" copy can be very lengthy -- can we get a TLDR version with option to "expand" where we would get this current copy after expanding
- [ ] look into polishing the prompts we inject into our workers, the initial prompt but then also eventual prompts that are injected mid session
- [ ] add config slider that adjusts the "surface this to me" sensitivity of the workers. (maybe some users will want their workers to surface more things. some users will want their workers to handle everything (except aborted complicated rebases)) this slider would change the prompts that the workers get when going over PRs
- [ ] add my new loading indicators from claude design
- [ ] can we make the threads clickable that go to the comment/thread in github?
- [ ] is it hard to surface the diff from the threads in our app?
- [ ] bug that double renders the agent reasoning on the cards -- the only one that should show up is the one that renders after the user decides to show it.  the static "always rendered" one can be removed
- [x] `pull-new-designs` skill — small updates now process efficiently: Step 0 `detect-baseline` + `git diff --no-index <baseline> <export>` localizes the delta directly (a one-color update reconciled in ~2 lines, no "big process"), and the verify gate scales its depth to the change. Validated on a real tiny update (the agent-working text color).
- [ ] `pull-new-designs` skill: on a full design-system-first import, PORT the usage intent into the app instead of leaving it baseline-only — merge the shipped `_adherence.oxlintrc.json` into the repo's lint, vendor the design system's `readme.md` usage guidance into a `design-system/README.md` (or CLAUDE.md), and fold any per-component `*.prompt.md` docs into component JSDoc.
