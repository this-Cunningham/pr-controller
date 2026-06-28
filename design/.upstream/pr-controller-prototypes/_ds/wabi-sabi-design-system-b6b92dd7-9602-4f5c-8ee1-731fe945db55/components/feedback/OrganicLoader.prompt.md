OrganicLoader — nineteen quiet pending states in the Wabi-sabi motion language. Each is a self-contained inline-flex glyph; pass `label` for a mono caption beneath.

```jsx
{busy && <OrganicLoader variant="ripple" label="Working…" />}
```

Variants: `enso` · `ripple` · `seal` · `brush` · `motes` · `reeds` · `kintsugi` · `stones` · `seeker` · `diviner` · `swarm` · `vigil` · `wisp` · `sentinel` · `drowse` · `scan` · `saccade` · `comet` · `veil`.

Pick by meaning — the default tint already encodes it:
- **active / positive** (sage) → `ripple`, `motes`, `stones`
- **neutral ambient** (ink) → `enso`, `brush`, `reeds`
- **urgent / held back** (seal/persimmon) → `seal`, `kintsugi` — reserve these for moments that genuinely need the user, the same restraint as the `--accent` seal elsewhere.

The **working blobs** are organic shapes that morph as they move, reading as something with intelligence behind them. Use them for indeterminate active work (reasoning, searching), not idle waiting:
- **seeker** (sage) — a blob morphing as it turns slowly, considering.
- **diviner** (sage) — seeker turned restless: morphing harder and breathing wider, at the same unhurried pace.
- **swarm** (sage) — three gooey blobs circling and merging, a restless collective mind.

And the **eye / gaze blobs** — the morphing blob read as a watching eye, for watchful/attentive work:
- **vigil** — one watchful eye sweeping the horizon, with irregular blinks and the occasional half-squint.
- **wisp** — the gaze and its after-image, attention lagging a beat behind.

The gaze on these moves like a real eye — fixating for a long beat, then darting — and never settles into a loop. Each gaze runs a primary path plus a second slow drift on a non-harmonic period, layered via the independent `translate` longhand so the two compose. Both layers are slow (cycles ~25–38s) and hold at long plateaus, so a single fixation lasts roughly 7–15 seconds; the dot is only fully still when both layers happen to be paused at once, and because their periods don't divide evenly, those moments land differently every time. The pacing is deliberately unhurried — meant to sit calmly through a long-running task rather than fidget. The positions, the cadence, and the pauses are all indeterminate. Two further families branch off it:

**vigil's family** — the watchful eye, four temperaments:
- **sentinel** — a wide, slow arc with an occasional double-blink or double-squint.
- **drowse** — heavy-lidded, drifting low, with long irregular blinks that sometimes only squint.
- **scan** — the eye tracing a slow oval, sweeping the whole field.
- **saccade** — quick darting glances that hold, then jump again.

**wisp's family** — the gaze and its after-images:
- **comet** — a tail of three after-images strung out behind the gaze.
- **veil** — a soft, oversized after-image trailing the sharp gaze.

`tone` (`"ink-2" | "auto-fg" | "accent"`) overrides the color only when context demands it. `size` (px) renders a compact square glyph for inline use (e.g. a leading mark in a status line) — best for the square variants. Every variant auto-desyncs: each instance mounts at a random point in its loop (a per-instance negative `animation-delay` applied to all its animated parts, outer blob included), so several of the same loader on a page drift independently instead of running in unison — pass `phase` (0–1) for a deterministic offset instead, and reduced-motion skips it. Keyframes ship in `tokens/base.css`, so link `styles.css` and they animate. Soft and slow by design — it's a settling beat, not a spinner; prefer one loader on screen at a time. Spreads `...rest` onto the root for `id`/`data-*`.

The **Skeleton** primitive already uses a neutral `enso` beside its cold-start caption. Reach for OrganicLoader directly for any new waiting moment.
