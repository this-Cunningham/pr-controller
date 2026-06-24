OrganicLoader — eight quiet pending states in the Wabi-sabi motion language. Each is a self-contained inline-flex glyph; pass `label` for a mono caption beneath.

```jsx
{busy && <OrganicLoader variant="ripple" label="Working…" />}
```

Variants: `enso` · `ripple` · `seal` · `brush` · `motes` · `reeds` · `kintsugi` · `stones`.

Pick by meaning — the default tint already encodes it:
- **active / positive** (sage) → `ripple`, `motes`, `stones`
- **neutral ambient** (ink) → `enso`, `brush`, `reeds`
- **urgent / held back** (seal/persimmon) → `seal`, `kintsugi` — reserve these for moments that genuinely need the user, the same restraint as the `--accent` seal elsewhere.

`tone` (`"ink-2" | "auto-fg" | "accent"`) overrides the color only when context demands it. `size` (px) renders a compact square glyph for inline use (e.g. a leading mark in a status line) — best for the square variants. Keyframes ship in `tokens/base.css`, so link `styles.css` and they animate. Soft and slow by design — it's a settling beat, not a spinner; prefer one loader on screen at a time. Spreads `...rest` onto the root for `id`/`data-*`.

The **Skeleton** primitive already uses a neutral `enso` beside its cold-start caption. Reach for OrganicLoader directly for any new waiting moment.
