# UI Kit — PR Controller

The assembled, interactive dashboard: the product's single screen.

- `index.html` — self-contained, click-through dashboard (React via CDN + Babel,
  linking the system's `styles.css`). Toggle safe/live, switch section tabs, approve/skip
  fixes, send a rebuttal, set a JIRA ticket, refresh. A first-fetch skeleton plays on load.

It composes the system primitives (`Button`, `Badge`, `DispositionTag`, `Tabs`, `ModeBadge`,
`Toast`, `EmptyState`, `Skeleton`) into the two product-specific compositions — **PR card**
and **thread row** — plus the header and JIRA banner. In a real app, import the published
components instead of the inline copies here.

Data is mocked at the top of `index.html` (`DATA`), shaped like the agent's `state.json`.
