# TODO

- [ ] make sure worktrees cleaned up after pr merged
- [ ] after worker ran on the PR and fixed issue + resolved threads -- the PR / threads still appear in "auto-handling" (maybe other tabs if it were to show up there)
- [ ] the "Agent surfaced" banner (e.g. the long mach5-validate/m5-base-behind-main explanation in the "waiting on reviewer" tab) is a complicated way of saying we need to rebase -- be more direct/simple, maybe just a "needs rebase" tag
- [x] waiting to rebase until all approved may be a bad idea since it will dismiss their reviews -- now: rebase folds into any feedback/CI worker run on conflict; if there's nothing else to do, a manual "Rebase" CTA appears (no quiet force-push). No longer approval-gated.
- [ ] Integrate the incoming design system (being dropped into a separate dir as the source of truth for look & feel) into the dashboard — replace the hardcoded styles/tokens in pr-controller-react (theme.css custom props, inline styles in components, meta.js tag/pill maps) with the design system's components/tokens, mirroring how it will eventually be integrated into the main app instead of hardcoding.
- [ ] "agent surfaced" copy can be very lengthy -- can we get a TLDR version with option to "expand" where we would get this current copy after expanding
