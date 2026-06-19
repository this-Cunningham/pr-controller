PRCard — the repeating PR unit, rendered for ONE tab.

```jsx
{allPRs.filter((pr) => prInTab(pr, tab)).map((pr) => (
  <PRCard key={pr.id} pr={pr} tab={tab} controller={dash} />
))}
```

**The unit is the ITEM, not the PR.** A PR can have a thread that needs you, another the agent fixed, and a merge conflict resolving — each routes to its own tab, so one PR may render in several tabs at once, each card showing only that tab's slice. Routing: `input`/`error` threads + `surfaced`/`outofsync` branch + missing JIRA → **needs**; `pending` threads + `conflict` branch → **progress**; `fixed`/`waiting` threads → **waiting**; `praise` shows nowhere. Use `prInTab(pr, tab)` to decide whether to render a card at all.

- `tab="needs"` is the only emphasis treatment (3px accent rule + seal dot) and is where the **StagedApprovalsBar** footer and JIRA banner appear.
- `tab="progress"` adds the quiet pulsing "Agent working" Callout.
- Composes Badge, BranchStatus, ThreadRow, JiraBanner, StagedApprovalsBar. Pass the same `controller` to every card.
