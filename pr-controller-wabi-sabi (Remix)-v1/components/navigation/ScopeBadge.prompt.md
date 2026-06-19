ScopeBadge — the header badge showing which PRs the agent watches.

```jsx
<ScopeBadge scope={scope} count={3} onToggle={toggleScope} />
```

This is NOT a safe/live switch — the agent always acts for real on the PRs it can see. `all` is calm (sage dot, "Watching all PRs"); `scoped` uses the accent with a hollow ring ("Scoped · N PRs") to flag that some PRs are deliberately out of view. Sits right of the wordmark, `gap:14px`.
