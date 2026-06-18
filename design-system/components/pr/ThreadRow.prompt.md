ThreadRow — a single reviewer comment thread; the controls adapt to the agent's disposition.

```jsx
<ThreadRow thread={thread} controller={dash} />
```

- `hashout` → rebuttal textarea + "Discuss in terminal" / "Send rebuttal"; resolves to a quoted, sent rebuttal with Undo.
- `agree` → "Approve fix" / "Skip", each resolving to a confirmation with Undo.
- `error` → "Open in terminal".
- `waiting` / `praise` → no action, just a caption.

`controller` supplies state + handlers (see PRController). Long bodies scroll inside the row.
