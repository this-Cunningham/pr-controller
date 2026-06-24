ThemeSwitcher — switch between the six Wabi-sabi themes at runtime.

```jsx
<ThemeSwitcher /> // uncontrolled: writes data-theme onto <html>
<ThemeSwitcher value={theme} onChange={setTheme} /> // controlled
```

Themes: `stone-dark` (default), `stone-light`, `warm-dark`, `warm-light`, `tea-dark`,
`tea-light`. Setting `data-theme` on `<html>` retints every token, so the whole UI follows.
