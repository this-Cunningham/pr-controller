Skeleton — the first-fetch loading state.

```jsx
{loading ? <Skeleton /> : <Content />}
```

Cards fade back (1 → 0.8 → 0.6) and shimmer gently, with a neutral `enso` beside the caption. Keep it brief; it's a settling beat, not a spinner. Pass `caption` to match the domain.
