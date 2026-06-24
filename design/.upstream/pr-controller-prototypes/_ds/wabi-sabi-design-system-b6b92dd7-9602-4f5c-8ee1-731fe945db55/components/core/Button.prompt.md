Button — the action control used across cards and banners; choose weight by stakes.

```jsx
<Button variant="primary" onClick={save}>Save</Button>
<Button variant="outline" onClick={reply}>Reply</Button>
<Button variant="ghost" onClick={skip}>Skip</Button>
```

- `primary` — solid ink on paper; the one decisive action.
- `outline` — secondary actions.
- `ghost` — low-stakes / dismiss.
- `disabled` dims to 0.45 and blocks the pointer.
