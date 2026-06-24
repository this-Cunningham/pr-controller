Tabs — a horizontal tab bar with optional count chips for switching between sibling views.

```jsx
<Tabs
  active={tab}
  onChange={setTab}
  tabs={[
    { key: "a", label: "Overview", count: 12 },
    { key: "b", label: "Open", count: 5, emphasize: true },
    { key: "c", label: "Archived", count: 4 },
  ]}
/>
```

The active tab carries a 2px accent underline; counts render as quiet mono chips. Set `emphasize` on a tab to render its count in accent when it's non-zero — use it to keep one important count visible from the other tabs (and keep that to a single tab, in the spirit of the rare seal accent). `sticky` (default true) pins the bar to the top of its scroll container; pass `sticky={false}` when it sits inside a card or panel. Order tabs however the domain reads best — by frequency, by priority, or just left-to-right.
