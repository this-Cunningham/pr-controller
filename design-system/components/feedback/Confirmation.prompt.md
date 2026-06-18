Confirmation — replaces a thread's controls once an action is taken.

```jsx
<Confirmation text="✓ Fix approved — applied by the agent." fg="var(--auto-fg)" onUndo={undo} />
<Confirmation text="Skipped — left for you." onUndo={undo} />
```

Use `fg="var(--auto-fg)"` (sage) for positive outcomes; default ink-2 for neutral ones. Always offer Undo for reversible actions.
