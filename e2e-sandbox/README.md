# widget-kit (e2e-sandbox)

A throwaway mini-library used **only** to pressure-test the pr-controller daemon
end-to-end. Nothing here is imported by the real app — it exists so dummy PRs can
carry realistic diffs, breakable CI, and merge conflicts without touching
production source.

- `src/` — a mix of small (`strings`, `math`, `colors`, `version`), medium
  (`inventory`) and big (`parser`) modules, plus non-JS files (`config.json`,
  `schema.yml`, `styles.css`).
- `test/` — `node --test` suites that CI runs on every PR touching `e2e-sandbox/**`.

Run locally:

```bash
cd e2e-sandbox && node --test "test/**/*.test.mjs"
```

> Safe to delete once the pressure test is done.
