PRCard — the repeating PR unit; composes Badge, ThreadRow and JiraBanner.

```jsx
<PRCard pr={pr} needsYou={section === "needs"} controller={dash} />
```

- `needsYou` is the only emphasis treatment: a 3px accent rule down the left edge + a seal dot. Use it only in the "Needs you" section.
- Review status renders as a mono Badge; signal pills (`auto` / `behind` / `ci`) as Badges, with `ci` in accent.
- Pass the same `controller` down to every card; it owns thread/JIRA state.
