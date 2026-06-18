DispositionTag — labels how the agent classified a reviewer thread.

```jsx
<DispositionTag tone="accent">disagree · hash out</DispositionTag>
<DispositionTag tone="sage">agree · auto-fix</DispositionTag>
<DispositionTag tone="neutral">waiting on reviewer</DispositionTag>
<DispositionTag tone="praise">praise</DispositionTag>
<DispositionTag tone="ochre">agent error</DispositionTag>
```

Tone ↔ disposition is fixed; don't recolor. Only `accent` (hash-out) signals "needs you".
