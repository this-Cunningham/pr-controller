Skeleton — the first-fetch loading state for the dashboard.

```jsx
{loading ? <Skeleton /> : <Sections />}
```

Cards fade back (1 → 0.8 → 0.6) and shimmer gently. Keep it brief (~850ms in the prototype); it's a settling beat, not a spinner.
