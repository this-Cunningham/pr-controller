ThreadRow — a single reviewer comment thread; controls adapt to the agent's disposition.

```jsx
<ThreadRow thread={thread} controller={dash} />
```

- `input` (needs your input) → up to two agent-drafted aids: a **Suggested approach** (Approve **stages** it into the PR's cart — see StagedApprovalsBar) and/or a pre-filled, editable **Suggested reply** (Send reply); plus **Discuss in terminal**. To change an approach, use the terminal rather than editing inline.
- `error` → **Open in terminal**.
- `pending` (no feedback yet) → "The agent is reviewing this now…".
- `fixed` / `waiting` / `praise` → no action, just a caption.

Long bodies clamp to 3 lines with a **Show more** toggle. The agent's reasoning is a one-line summary by default; **Show agent's reasoning** reveals the full rationale. `controller` supplies state + handlers (see PRController).
