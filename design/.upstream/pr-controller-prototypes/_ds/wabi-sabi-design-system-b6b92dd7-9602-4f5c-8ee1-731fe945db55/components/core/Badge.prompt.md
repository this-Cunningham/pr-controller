Badge — small status pill for object-level state and signals.

```jsx
<Badge tone="active" mono>Done</Badge>
<Badge tone="neutral" mono>Active</Badge>
<Badge tone="outline" mono>Draft</Badge>
<Badge tone="neutral">3 updates</Badge>
<Badge tone="urgent">overdue</Badge>
```

- `mono` for tracked uppercase status pills; plain for inline signal pills.
- `tone="urgent"` is the only attention-drawing tint — reserve it for things that genuinely need the user, the same restraint as the seal accent elsewhere.
- `outline` is the de-emphasized / draft treatment (hairline, no fill).
- `dot` adds a leading marker.
- **Badge vs DispositionTag:** Badge is a sans status pill for an object's overall state or signals; **DispositionTag** is the mono, uppercase, tracked chip for a row-level disposition. Same tints, different unit — don't nest a Badge inside a tag row.
