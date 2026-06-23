# My pr-controller config (this-Cunningham)

config.mjs auto-loads a gitignored `config.local.json`. On a new device, write mine below and
the setup persists (no env sourcing). Select a profile with `PRC_PROFILE` or the `profile` key.

> Holds my enterprise host + internal PR refs. `git rm --cached MY-PRC-CONFIG.md` + gitignore
> it if I don't want it in history.

## config.local.json
```json
{
  "profile": "dev",
  "cloneRoot": "/Users/ccunningham/cargurus",
  "gitProtocol": "ssh",
  "profiles": {
    "prod": { "host": "code.cargurus.com", "owner": "cargurus-eng", "login": "ccunningham",
              "onlyPRs": ["site-vdp-remix#835","cargurus-listings-ui#2129","site-vdp-remix#717"] },
    "dev":  { "host": "github.com", "owner": "this-Cunningham", "login": "this-Cunningham",
              "onlyPRs": ["pr-controller#1","pr-controller#2","pr-controller#3"] },
    "e2e":  { "host": "github.com", "owner": "this-Cunningham", "login": "this-Cunningham",
              "onlyPRs": ["pr-controller#8","pr-controller#9","pr-controller#10","pr-controller#11","pr-controller#12","pr-controller#13","pr-controller#15","pr-controller#16","pr-controller#18","pr-controller#19","pr-controller#20","pr-controller#21","pr-controller#22","pr-controller#23","pr-controller#24","pr-controller#25","pr-controller#26","pr-controller#27","pr-controller#28"] }
  }
}
```

## auth (run in my terminal — never in chat)
```bash
gh auth status --hostname code.cargurus.com || gh auth login --hostname code.cargurus.com
gh auth status --hostname github.com        || gh auth login --hostname github.com
```

## run
```bash
PRC_PROFILE=prod node server.mjs    # or dev / e2e (default: the "profile" key above)
```

## gotchas (hit while setting this up)
- config.local.json is **gitignored** — `git add -f` to commit it. Once committed it's tracked, so
  edits then show in `git status` (gitignore only hides *untracked* files); `git rm --cached config.local.json` to untrack.
- **JSON only, no comments.** A parse error is logged (`[config] config.local.json failed to parse`)
  and the file ignored — if your config seems to do nothing, check for a JSON typo.
- **cloneRoot must be an absolute path** (no `~`). A wrong cloneRoot only bites at WORKER time
  (clone/worktree), not at scan time — so scanning can look fine while workers can't clone.
- The `profile` key picks the profile for a bare `node server.mjs`; `PRC_PROFILE=prod` switches it.
- You can only test a profile whose host you're authed on / can reach (prod=cargurus won't scan from elsewhere).
