ScopeBadge — a two-state toggle showing whether a view covers everything or a scoped subset.

```jsx
<ScopeBadge scope={scope} count={3} onToggle={toggleScope} />
<ScopeBadge scope="all" allLabel="All projects" scopedLabel="This team only" onToggle={toggle} />
```

`all` is calm (sage dot); `scoped` uses the accent with a hollow ring ("Scoped · N") to gently flag that some items are deliberately out of view. Override `allLabel` / `scopedLabel` to fit the domain — it's a generic "everything vs. a filtered subset" control, not tied to any particular layout. Pairs naturally beside a wordmark or filter row (`gap:14px`), but works anywhere a filtered/unfiltered distinction matters.
