# My pr-controller config — restore runbook (this-Cunningham)

`config.mjs` now ships neutral (configured via `PRC_*`). These are MY real values, preserved
here so I can re-wire my local device after pulling the configurable-config updates.

> Holds my enterprise host + internal PR refs. It's committed so a `git pull` brings it down;
> if I'd rather it not be in history, `git rm --cached MY-PRC-CONFIG.md` + add it to `.gitignore`.

## Claude: wire this up on my machine
When I pull these updates and ask to set up, run the **setup-pr-controller** skill using the
profile I name below — write it into a gitignored `prc.env`, run the gh/git deps, then verify
`localhost:4317/state.json` shows my PRs.

## prod (cargurus) → prc.env
```bash
cat > prc.env <<'EOF'
export PRC_HOST=code.cargurus.com
export PRC_LOGIN=ccunningham
export PRC_OWNER=cargurus-eng
export PRC_ONLY_PRS="site-vdp-remix#835,cargurus-listings-ui#2129,site-vdp-remix#717"
export PRC_CLONE_ROOT="$HOME/cargurus"
export PRC_GIT_PROTOCOL=ssh
EOF
```

## dev (personal github sandbox) → prc.env
```bash
cat > prc.env <<'EOF'
export PRC_HOST=github.com
export PRC_LOGIN=this-Cunningham
export PRC_OWNER=this-Cunningham
export PRC_ONLY_PRS="pr-controller#1,pr-controller#2,pr-controller#3"
export PRC_CLONE_ROOT="$HOME/cargurus"
export PRC_GIT_PROTOCOL=ssh
EOF
```

## e2e sandbox PRs
```bash
export PRC_HOST=github.com PRC_LOGIN=this-Cunningham PRC_OWNER=this-Cunningham
export PRC_ONLY_PRS="pr-controller#8,pr-controller#9,pr-controller#10,pr-controller#11,pr-controller#12,pr-controller#13,pr-controller#15,pr-controller#16,pr-controller#18,pr-controller#19,pr-controller#20,pr-controller#21,pr-controller#22,pr-controller#23,pr-controller#24,pr-controller#25,pr-controller#26,pr-controller#27,pr-controller#28"
```

## Or paste my real profiles into config.mjs (local edit, keep it uncommitted)
config.mjs ships with neutral `PROFILES`; replace them locally with mine, then select with
`PRC_PROFILE=dev` / `PRC_PROFILE=prod` (or `PRC_DEV=1`):
```js
const PROFILES = {
  prod: { host: 'code.cargurus.com', owner: 'cargurus-eng', login: 'ccunningham',
          onlyPRs: ['site-vdp-remix#835', 'cargurus-listings-ui#2129', 'site-vdp-remix#717'] },
  dev:  { host: 'github.com', owner: 'this-Cunningham', login: 'this-Cunningham',
          onlyPRs: ['pr-controller#1', 'pr-controller#2', 'pr-controller#3'] },
};
```

## deps (git/gh/claude assumed already set up — only the deltas)
```bash
gh auth status --hostname code.cargurus.com || gh auth login --hostname code.cargurus.com  # prod host, if not authed
gh auth setup-git --hostname <host>    # only if I switch a profile to PRC_GIT_PROTOCOL=https
```
`workerModel` defaults to `sonnet` in config.mjs — set `PRC_WORKER_MODEL=haiku` only for cheap testing.

## verify
```bash
source prc.env && PRC_POLL_MINUTES=1440 node server.mjs &   # then: curl -s localhost:4317/state.json | head
```
