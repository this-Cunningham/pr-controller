StagedApprovalsBar — fires one agent run for everything staged on a PR.

```jsx
<StagedApprovalsBar count={2} running={running} onRun={() => runAgent(pr.id)} />
```

A per-PR cart action, distinct from a single thread's control. Each thread's **Approve approach** increments this PR's `count`; **Run agent (N)** fires ONE worker that carries out all staged approaches together. Disables itself at `count === 0`; once run, it shows the `›_ Agent run started` state. Render it as the card footer in the Needs-you tab only.
