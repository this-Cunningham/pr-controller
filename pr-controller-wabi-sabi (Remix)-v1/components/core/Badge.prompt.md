Badge — small status pill for review state and PR signals.

```jsx
<Badge tone="sage" mono>Approved</Badge>
<Badge tone="neutral" mono>Review required</Badge>
<Badge tone="outline" mono>Draft</Badge>
<Badge tone="neutral">behind base</Badge>
<Badge tone="accent">CI failing: unit-api</Badge>
```

- `mono` for review-status pills (uppercase, tracked). Plain for signal pills.
- Signal pills cover branch state only — `behind base` (neutral) and `CI failing: <check>` (accent). `tone="accent"` is the only attention-drawing tint; use it for CI failures, sparingly.
- `dot` adds a leading marker (rarely needed now that "N auto-fixable" is gone).
