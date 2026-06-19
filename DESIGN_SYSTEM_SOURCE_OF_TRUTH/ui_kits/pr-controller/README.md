# UI Kit — PR Controller

The assembled, interactive dashboard: the product's single screen.

- `index.html` — self-contained, click-through dashboard (React via CDN + Babel,
  linking the system's `styles.css`). Toggle scope (all ⇄ scoped), switch section tabs,
  approve an approach &amp; Run agent, send a reply, open a terminal, set a JIRA ticket,
  refresh. A first-fetch skeleton plays on load.

It composes the system primitives (`Button`, `Badge`, `DispositionTag`, `Tabs`, `ScopeBadge`,
`BranchStatus`, `StagedApprovalsBar`, `Toast`, `EmptyState`, `Skeleton`) into the two
product-specific compositions — **PR card** and **thread row** — plus the header and JIRA
banner. In a real app, import the published components instead of the inline copies here.

The unit is the ITEM: each thread tag and branch kind routes to a tab, so one PR can appear
in several tabs. Data is mocked at the top of `index.html` (`PRS`), shaped like the agent's
`state.json`.
