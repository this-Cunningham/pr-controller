DispositionTag — a mono, uppercase, tracked chip labeling a row-level state.

```jsx
<DispositionTag tone="urgent">needs attention</DispositionTag>
<DispositionTag tone="active">in progress</DispositionTag>
<DispositionTag tone="neutral">waiting</DispositionTag>
<DispositionTag tone="pending">not started</DispositionTag>
<DispositionTag tone="praise">praise</DispositionTag>
<DispositionTag tone="error">failed</DispositionTag>
```

`urgent` is the only tone that draws attention — keep it rare. `pending` is a dashed, unfilled chip for a not-started item, deliberately fainter than `neutral`. This chip is presentational — the caller owns the label text; use **Badge** for an object's overall state and DispositionTag for a row's state. Tones speak the abstract vocabulary (urgent / active / neutral / pending / praise / error) shared across all primitives.
