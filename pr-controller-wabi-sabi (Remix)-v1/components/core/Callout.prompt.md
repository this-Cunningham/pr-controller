Callout — a left-ruled status box; the system's main ambient-status surface.

```jsx
<Callout tone="urgency" eyebrow="Branch out of sync" dot>
  <code>feature/sso</code> has diverged from origin — the agent couldn't fast-forward.
</Callout>

<Callout tone="agent" eyebrow="Agent working" dot pulse>Applying 3 approved fixes…</Callout>

<Callout tone="quiet" eyebrow="Suggested approach">Chunk the backfill and checkpoint every 10k rows.</Callout>

<Callout tone="quiet">“Please keep the early-return guard.”</Callout>  {/* quoted reply */}
```

- `urgency` (accent) for things that need you; `agent` (sage) for auto/working; `quiet` (neutral) for suggestions and quoted text.
- `pulse` only with a live state ("agent working" / merge conflict resolving) — the same ambient pulse used when the agent is actively on a PR.
- Keep bodies short; this is status, not an article.
