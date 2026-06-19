Tabs — the sticky priority tabs that switch the visible section.

```jsx
<Tabs
  active={tab}
  onChange={setTab}
  tabs={[
    { key: "needs", label: "Needs you", count: 5, emphasize: true },
    { key: "progress", label: "In progress", count: 3 },
    { key: "waiting", label: "Waiting on reviewer", count: 4 },
  ]}
/>
```

Order tabs by priority (most urgent first). Because the unit is the ITEM, a single PR can be counted in more than one tab at once. `emphasize` the "Needs you" count so a non-zero backlog is visible even from another tab. Sticky by default.
