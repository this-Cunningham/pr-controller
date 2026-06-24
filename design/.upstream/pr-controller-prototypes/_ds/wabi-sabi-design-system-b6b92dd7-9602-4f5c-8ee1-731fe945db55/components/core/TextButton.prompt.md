TextButton — a quiet inline text/link button for low-stakes actions.

```jsx
<TextButton onClick={undo}>Undo</TextButton>
<TextButton tone="muted" onClick={expand}>Show more</TextButton>
```

Use for reversible or expand/collapse affordances inside dense rows. For anything decisive use `Button` instead.
