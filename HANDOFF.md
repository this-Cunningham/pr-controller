# Handoff: wire up pr-controller on this device

Branch: `claude/pressure-test-dummy-prs-doseea` (PR #29). Assumes `git`, `gh`, `claude` already work.

## 1. config
`config.local.json` is committed (force; it's gitignored). Untrack it so local edits aren't tracked:
```bash
git rm --cached config.local.json
```
Then edit `config.local.json` (schema: `config.local.schema.json`):
- `cloneRoot` — absolute path to your local clones (no `~`).
- `profile` — which profile a bare `node server.mjs` uses (`prod` | `dev` | `e2e`).
- `profiles.prod.onlyPRs` — `[]` for all your open non-draft PRs (production), or a list for testing.

## 2. deps
```bash
gh auth status --hostname <host>     # else: gh auth login --hostname <host>
# ssh: key on GitHub. https: gh auth setup-git --hostname <host>  + set "gitProtocol":"https"
# PAT scopes: Pull requests read+write, Contents read+write (or classic repo)
( cd pr-controller-react && yarn install && yarn build )
```

## 3. run + verify
```bash
node server.mjs                        # default profile (or: PRC_PROFILE=prod node server.mjs)
curl -s localhost:4317/state.json      # expect your PRs; "lastPollError": null
# open http://localhost:4317
```

## notes
- Config is read once at startup — restart on any config change.
- A malformed `config.local.json` logs `[config] config.local.json failed to parse` and is ignored.
- Or run the `setup-pr-controller` skill instead of doing the above by hand.
