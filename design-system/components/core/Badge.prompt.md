Badge — small status pill for review state and PR signals.

```jsx
<Badge tone="sage" mono>Approved</Badge>
<Badge tone="neutral" mono>Review required</Badge>
<Badge tone="outline" mono>Draft</Badge>
<Badge tone="neutral" dot>3 auto-fixable</Badge>
<Badge tone="accent">CI failing: unit-api</Badge>
```

- `mono` for review-status pills (uppercase, tracked). Plain for signal pills.
- `tone="accent"` is the only attention-drawing tint — use it for CI failures, sparingly.
- `dot` adds a leading marker, used by "N auto-fixable".
