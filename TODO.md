# TODO

- [ ] make sure worktrees cleaned up after pr merged
- [x] after worker ran on the PR and fixed issue + resolved threads -- the PR / threads still appear in "auto-handling" (maybe other tabs if it were to show up there) — fixed: server.mjs now (a) only honors a `surfaced` rebase while the branch still actually conflicts (no stale pin), and (b) unlinks the stale `worker-<repo>-<num>.json` once none of its actions match a live thread and the branch is clean.
- [ ] the "Agent surfaced" banner (e.g. the long mach5-validate/m5-base-behind-main explanation in the Needs you lane) is a complicated way of saying we need to rebase -- be more direct/simple, maybe just a "needs rebase" tag
- [x] waiting to rebase until all approved may be a bad idea since it will dismiss their reviews -- now: rebase folds into any feedback/CI worker run on conflict; if there's nothing else to do, a manual "Rebase" CTA appears (no quiet force-push). No longer approval-gated.
- [x] Integrate the incoming design system into the dashboard — done: the Wabi-Sabi design system is vendored into pr-controller-react (CSS modules + tokens) and the theme is frozen; adapt.js maps dispositions to the DS tag vocabulary.
- [ ] "agent surfaced" copy can be very lengthy -- can we get a TLDR version with option to "expand" where we would get this current copy after expanding
- [ ] look into polishing the prompts we inject into our workers, the initial prompt but then also eventual prompts that are injected mid session
