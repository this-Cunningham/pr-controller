---
name: setup-pr-controller
version: 2.0.0
description: >-
  Help a user configure pr-controller and get it unblocked on first run or a new device.
  Opens config.mjs (the config surface), helps fill in their PRC_* values into a sourced
  prc.env, sets up the gh/git/claude dependencies, and verifies with one scan. Use for
  first-time setup, re-setup on a new machine, an empty / "scan failing" dashboard, or
  workers that take no action.
---

# Set up pr-controller

Open [config.mjs](config.mjs) and walk the user through it — each field names its `PRC_*`
env var and what it needs. Collect their values (ask via AskUserQuestion), write them into a
`prc.env` at the repo root, set up the external deps, and verify.

```bash
grep -qxF 'prc.env' .gitignore || echo 'prc.env' >> .gitignore
```

## 1. Fill in config (read config.mjs WITH the user) → prc.env
Collect: `PRC_HOST`, `PRC_LOGIN`, `PRC_OWNER`, `PRC_ONLY_PRS` (the scope — empty = ALL their
open PRs, so keep it tight), `PRC_CLONE_ROOT`, `PRC_GIT_PROTOCOL` (ssh/https), and optionally
`PRC_WORKER_MODEL`. Write them:
```bash
cat > prc.env <<'EOF'
export PRC_HOST=github.com
export PRC_LOGIN=<login>
export PRC_OWNER=<owner>
export PRC_ONLY_PRS="repo#1,repo#2"
export PRC_CLONE_ROOT="$HOME/<clones-dir>"
export PRC_GIT_PROTOCOL=ssh
# export PRC_WORKER_MODEL=sonnet   PRC_PORT=4317   PRC_POLL_MINUTES=30
EOF
```
Validate each `repo#n` is a real OPEN PR: `GH_HOST=$PRC_HOST gh pr view <n> --repo <owner>/<repo>`.

## 2. Dependencies — run these
```bash
gh auth login --hostname <host>       # if not already authed
gh auth status --hostname <host>      # confirm the right account is active
gh auth setup-git --hostname <host>   # so git push authenticates (needed for https)
git config --global user.name  "<name>"
git config --global user.email "<email>"
claude -p "reply ok" --max-turns 1    # claude authed?
( cd pr-controller-react && yarn install --silent && yarn build )   # dashboard (503 until built)
```
- ssh protocol: confirm a key — `ssh -T git@<host>`.
- If `id -u` is `0` (root), workers need a **non-root user**, or `IS_SANDBOX=1` only in a
  genuine ephemeral container.

## 3. Verify
```bash
source prc.env && PRC_POLL_MINUTES=1440 node server.mjs > /tmp/prc.log 2>&1 &
# after "[poll] N PRs":
curl -s localhost:${PRC_PORT:-4317}/state.json | head -c 200    # expected PRs, not empty / "scan failing"
grep -L "dangerously-skip-permissions cannot" data/worker-*.log 2>/dev/null  # a dispatched worker acted
pkill -f 'node server.mjs'
```

Notes: config is read once → restart on any change. The daemon won't scan until `PRC_LOGIN`
and a scope are set. For a quick render-only check, use the `run-pr-controller` skill.
