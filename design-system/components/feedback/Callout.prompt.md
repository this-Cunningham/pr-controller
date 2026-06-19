Callout — a left-ruled tinted box with an optional eyebrow, status dot, and body. The recurring "agent surfaced / working / proposes…" and quoted-reply blocks.

```jsx
<Callout tone="accent" label="Agent surfaced">{reason}</Callout>
<Callout tone="sage" label="Suggested approach">{text}<div>{actionRow}</div></Callout>
<Callout tone="sage" dot pulse label="Agent working" />
<Callout tone="neutral">You: {rebuttal}</Callout>
```

- `tone` — `accent` for urgency (surfaced, out-of-sync, CI), `sage` for agent/auto/proposed, `neutral` for a quiet quote.
- `label` — uppercase-mono eyebrow; omit for a body-only quote.
- `dot` / `pulse` — leading status dot; `pulse` adds the ambient working motion (only piece of ambient motion in the system — use sparingly).
- `children` — the body; may include an action row. Omit for a dot+label-only strip.

Reserve `accent` for genuine urgency, per the brand's single-accent discipline.
