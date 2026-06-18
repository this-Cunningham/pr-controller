Tabs — the sticky priority tabs that switch the visible section.

```jsx
<Tabs
  active={tab}
  onChange={setTab}
  tabs={[
    { key: "needs", label: "Needs you", count: 2, emphasize: true },
    { key: "auto", label: "Auto-handling", count: 2 },
    { key: "waiting", label: "Waiting on reviewer", count: 2 },
  ]}
/>
```

Order tabs by priority (most urgent first). `emphasize` the "Needs you" count so a non-zero backlog is visible even from another tab. Sticky by default.
