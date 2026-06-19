Button — the action control used across cards and banners; choose weight by stakes.

```jsx
<Button variant="primary" onClick={approve}>Approve fix</Button>
<Button variant="outline" onClick={send}>Send rebuttal</Button>
<Button variant="ghost" onClick={skip}>Skip</Button>
```

- `primary` — solid ink on paper; the one decisive action (Approve fix, Set ticket, Discuss in terminal).
- `outline` — secondary (Send rebuttal, Open in terminal).
- `ghost` — low-stakes / dismiss (Skip).
- `disabled` dims to 0.45 and blocks the pointer.
