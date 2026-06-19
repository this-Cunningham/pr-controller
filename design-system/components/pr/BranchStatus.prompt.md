BranchStatus — PR-level branch health, separate from per-thread actions.

```jsx
<BranchStatus state="out-of-sync" branch="feature/sso" ahead={3} behind={7}
  onRebase={rebase} onResolveTerminal={openTerminal} resolving={resolving} />

<BranchStatus state="working" branch="feature/sso" />            {/* live, pulsing */}

<BranchStatus state="suggested" suggestion="Chunk the backfill and checkpoint every 10k rows."
  onApprove={approve} />
```

- `out-of-sync` is urgency-toned (the branch diverged and the agent couldn't fast-forward); offers **Rebase branch** + **Resolve in terminal**. Set `resolving` to show the terminal hand-off note.
- `working` is the agent applying approved changes — the one place to use the pulsing dot.
- `suggested` proposes an approach with a single **Approve approach** CTA.

Place it in the PR card header area, above the threads. For the "apply all staged approvals" action, use `StagedApprovalsBar`.
