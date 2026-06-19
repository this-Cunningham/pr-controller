StagedApprovalsBar — runs the agent against everything you've approved.

```jsx
<StagedApprovalsBar count={3} onRun={runAgent} running={running} />
```

A PR- or page-level batch action, distinct from a single thread's "Approve fix". Disables itself at `count === 0`. Pair it with staged `agree`-fix threads: each Approve increments the count, this applies them together.
