DispositionTag — labels how the agent classified a reviewer thread.

```jsx
<DispositionTag tone="accent">needs your input</DispositionTag>
<DispositionTag tone="sage">agent fixed · waiting on reviewer</DispositionTag>
<DispositionTag tone="neutral">waiting on reviewer</DispositionTag>
<DispositionTag tone="pending">no feedback yet</DispositionTag>
<DispositionTag tone="praise">praise</DispositionTag>
<DispositionTag tone="ochre">agent error</DispositionTag>
```

Tone ↔ disposition is fixed; don't recolor. `accent` ("needs your input") is the only one that signals "needs you". `pending` ("no feedback yet") is a dashed, unfilled chip for a thread the agent hasn't classified yet — deliberately fainter than `neutral` ("waiting on reviewer"). `praise` is shown in no tab normally.
