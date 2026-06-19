BranchStatus — PR-level branch health, separate from per-thread actions.

```jsx
{/* In progress — informational, pulsing, no button */}
<BranchStatus state="conflict" />

{/* Needs you — the agent bailed on a risky rebase */}
<BranchStatus state="surfaced"
  details="Both branches renamed the same export; auto-merge would drop one side."
  detailsOpen={open} onToggleDetails={toggle}
  terminalOpen={opened} onTerminal={openTerminal} />

{/* Needs you — branch diverged and the agent never ran */}
<BranchStatus state="outofsync" terminalOpen={opened} onTerminal={openTerminal} />
```

- `conflict` is informational + pulsing — the agent rebases as part of its single run; **no manual rebase button**. Routes to In progress.
- `surfaced` is the agent's bail-out: a calm one-line urgency note, a **Show details** expander, and **Open in terminal**. Routes to Needs you.
- `outofsync` (the agent never ran) offers **Resolve in terminal**. Routes to Needs you.

Place it in the card body, above the threads. Every Needs-you branch state keeps the terminal escape hatch.
