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

## deps (once per machine)
```bash
gh auth login --hostname <host>        # code.cargurus.com for prod, github.com for dev
gh auth setup-git --hostname <host>
git config --global user.name  "<my name>"
git config --global user.email "<my email for that host>"
```
`workerModel` defaults to `sonnet` in config.mjs — set `PRC_WORKER_MODEL=haiku` only for cheap testing.

## verify
```bash
source prc.env && PRC_POLL_MINUTES=1440 node server.mjs &   # then: curl -s localhost:4317/state.json | head
```
