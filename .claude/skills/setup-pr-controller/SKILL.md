---
name: setup-pr-controller
version: 3.0.0
description: >-
  Help a user configure pr-controller and get it unblocked (first run or new device). Opens
  config.mjs, collects their non-secret values into a persistent config.local.json, and
  guides auth (gh / ssh) which the USER runs in their own terminal / GitHub settings — secrets
  never go through chat. Use for first-time setup, re-setup on a new machine, an empty /
  "scan failing" dashboard, or workers that take no action.
---

# Set up pr-controller

Open [config.mjs](config.mjs) and help the user fill it in. Their values persist in a
gitignored `config.local.json` (auto-loaded every run — no env sourcing).

**Never put secrets (tokens, SSH keys) in the chat.** Auth is done by the user in their own
terminal / GitHub settings; the agent collects only non-secret config and writes the file.

## 1. Collect non-secret config → config.local.json
Read config.mjs with the user and collect: host, login, owner, scope (keep it tight — empty =
ALL their PRs), cloneRoot (absolute path), gitProtocol. Write it:
```bash
cat > config.local.json <<'EOF'
{
  "profile": "dev",
  "cloneRoot": "/absolute/path/to/your/clones",
  "gitProtocol": "ssh",
  "profiles": {
    "dev": { "host": "github.com", "owner": "<owner>", "login": "<login>",
             "onlyPRs": ["<repo>#1","<repo>#2"] }
  }
}
EOF
```
Validate each `<repo>#n` is a real OPEN PR: `GH_HOST=<host> gh pr view <n> --repo <owner>/<repo>`.

## 2. Auth — the USER runs these in their terminal (secrets stay local)
- **gh:** `gh auth status --hostname <host>`. If not authed, tell the user to run `gh auth
  login --hostname <host>` (interactive; the token never goes through chat). Need a token?
  They create one at **GitHub → Settings → Developer settings → Personal access tokens** —
  fine-grained, permissions **Pull requests: read** + **Contents: read/write** — then
  `gh auth login --with-token` (pasted in their terminal).
- **https push** (only if gitProtocol=https): the user runs `gh auth setup-git --hostname <host>`.
- **ssh** (only if gitProtocol=ssh): if they have no key, `ssh-keygen -t ed25519`, then add
  `~/.ssh/id_ed25519.pub` at **GitHub → Settings → SSH and GPG keys**; verify `ssh -T git@<host>`.

## 3. Build + verify
```bash
( cd pr-controller-react && yarn install --silent && yarn build )
PRC_POLL_MINUTES=1440 node server.mjs > /tmp/prc.log 2>&1 &
curl -s localhost:4317/state.json | head -c 200    # expected PRs, not empty / "scan failing"
```
Root only: if `id -u` is `0`, workers need a non-root user (or `IS_SANDBOX=1` in a container).
