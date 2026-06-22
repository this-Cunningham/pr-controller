---
name: setup-pr-controller
version: 3.1.0
description: >-
  Help a user configure pr-controller and get it unblocked (first run or new device). Lists
  the dependencies needed, then points Claude at config.mjs / config.local.json to help the
  user fill in their non-secret config. Assumes claude + GitHub already work on the machine;
  auth/tokens are set up by the USER in their terminal, never in chat. Use for first-time
  setup, re-setup on a new machine, an empty / "scan failing" dashboard, or workers that no-op.
---

# Set up pr-controller

Assumes claude and GitHub already work on the machine. `config.mjs` auto-loads a gitignored
`config.local.json` — Claude helps the user write it. Auth/token setup is done by the user in
their own terminal (never paste secrets in chat).

## Dependencies needed for initial setup
- **Node ≥ 18 + Yarn** — build the dashboard + run the daemon.
- **gh CLI authed on the host** (`gh auth status --hostname <host>`) with a git transport — either:
  - **(a) SSH** — an SSH key on GitHub, and `gitProtocol: "ssh"`, OR
  - **(b) HTTPS** — `gh auth setup-git --hostname <host>`, and `gitProtocol: "https"`.
- **Token** — `gh auth login` provisions one. If bringing your own PAT: **fine-grained** with
  **Pull requests: read** + **Contents: read & write** (worker pushes), or a classic PAT with `repo`.
- **(optional) Local clones** of the repos you watch, under your `cloneRoot` — else the daemon
  clones them fresh over the transport above.

## Then fill in config.local.json (Claude helps)
Open [config.mjs](config.mjs) to see every field, then write `config.local.json` with the user's
non-secret values. `onlyPRs` is the circuit-breaker — empty = ALL their PRs, so keep it tight.
```bash
cat > config.local.json <<'EOF'
{
  "profile": "dev",
  "cloneRoot": "/absolute/path/to/clones",
  "gitProtocol": "ssh",
  "profiles": {
    "dev": { "host": "github.com", "owner": "<owner>", "login": "<login>",
             "onlyPRs": ["<repo>#1","<repo>#2"] }
  }
}
EOF
```
Validate each PR is open (`GH_HOST=<host> gh pr view <n> --repo <owner>/<repo>`), then run:
```bash
( cd pr-controller-react && yarn build ) && node server.mjs   # http://localhost:4317
```
