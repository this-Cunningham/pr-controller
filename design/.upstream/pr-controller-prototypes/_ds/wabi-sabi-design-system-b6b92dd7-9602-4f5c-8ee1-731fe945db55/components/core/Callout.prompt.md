Callout — a left-ruled status box; the system's main ambient-status surface.

```jsx
<Callout tone="urgent" eyebrow="Needs attention" dot>
  A required field is missing — resolve it to continue.
</Callout>

<Callout tone="active" eyebrow="Working" dot pulse>Applying 3 changes…</Callout>

<Callout tone="neutral" eyebrow="Suggested approach">Chunk the backfill and checkpoint every 10k rows.</Callout>

<Callout tone="neutral">"Please keep the early-return guard."</Callout>  {/* quoted text */}
```

- `urgent` (accent) for things that need attention; `active` (sage) for in-progress / positive; `neutral` for suggestions and quoted text.
- `pulse` only with a live state — pair it with `dot` for an "in progress" beat.
- Keep bodies short; this is status, not an article.
