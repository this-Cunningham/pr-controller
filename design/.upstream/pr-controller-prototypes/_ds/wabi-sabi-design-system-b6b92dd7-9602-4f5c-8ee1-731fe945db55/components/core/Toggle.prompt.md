Toggle — binary on/off switch for a single setting.

```jsx
<Toggle defaultChecked label="Email digests" />
<Toggle checked={notify} onChange={setNotify} label="Notifications" />
<Toggle checked disabled label="Locked setting" />
```

- Controlled (`checked` + `onChange`) or uncontrolled (`defaultChecked`).
- Three visual states: **on** (sage track), **off** (quiet filled surface + hairline), **disabled** (dashed track, ignores input).
- Use for an immediate, self-applying boolean setting. For a choice the user must confirm, use a Button pair instead.
- Pass `label` for the common switch-plus-text row; omit it to place the bare switch (e.g. in a table cell or toolbar).
- One toggle = one setting. Don't group several as a substitute for a multi-select.
