DispositionTag — labels how the agent classified a reviewer thread.

```jsx
<DispositionTag tone="accent">disagree · hash out</DispositionTag>
<DispositionTag tone="sage">agree · auto-fix</DispositionTag>
<DispositionTag tone="neutral">waiting on reviewer</DispositionTag>
<DispositionTag tone="praise">praise</DispositionTag>
<DispositionTag tone="ochre">agent error</DispositionTag>
<DispositionTag tone="pending">not yet judged</DispositionTag>
```

Tone ↔ disposition is fixed; don't recolor. `accent` (hash-out) is the only one that signals "needs you". `pending` is a dashed, unfilled chip for a thread the agent hasn't classified yet — deliberately fainter than `neutral` (waiting on reviewer).
