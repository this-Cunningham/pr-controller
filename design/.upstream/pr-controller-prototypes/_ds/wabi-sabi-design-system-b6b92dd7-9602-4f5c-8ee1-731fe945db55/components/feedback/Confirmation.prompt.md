Confirmation — a calm inline acknowledgment line shown after an action resolves.

```jsx
<Confirmation text="✓ Saved." fg="var(--auto-fg)" onUndo={undo} />
<Confirmation text="Dismissed." onUndo={undo} />
```

Use `fg="var(--auto-fg)"` (sage) for positive outcomes; default ink-2 for neutral ones. Provide `onUndo` to offer an Undo link for reversible actions. Often used to replace an item's controls in place once it's been acted on.
