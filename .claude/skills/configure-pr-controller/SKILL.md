---
name: configure-pr-controller
version: 3.2.1
description: >-
  Help a user configure pr-controller and get it unblocked (first run or new device). Lists
  the dependencies needed, then points Claude at config.ts / config.local.json to help the
  user fill in their non-secret config. Assumes claude + GitHub already work on the machine;
  auth/tokens are set up by the USER in their terminal, never in chat. Use for first-time
  setup, re-setup on a new machine, an empty / "scan failing" dashboard, or workers that no-op.
---

# Configure pr-controller

Assumes `claude` and GitHub already work on the machine. `config.ts` auto-loads a gitignored
`config.local.json` — Claude helps the user write or **edit** it. Auth/token setup is done by the
user in their own terminal (never paste secrets in chat).

> **Launching is safe — polling is OFF by default and never auto-starts.** Starting the
> process only serves the dashboard and seeds idle state; nothing is scanned or dispatched
> until you explicitly flip the polling toggle on from the dashboard. **Arming is what runs
> for real — there is no dry-run.** Once armed, the daemon dispatches headless workers that
> commit / push / `--force-with-lease` rebase / reply on every PR in `config.onlyPRs`. Empty
> `onlyPRs` = ALL your open PRs. Scope it tight *before arming* (see Run).

## Dependencies
- **Node ≥ 18 + Yarn** — build the dashboard + run the daemon.
- **gh CLI authed on the host:** `gh auth status --hostname <host>` (else `gh auth login --hostname <host>`).
- **A git transport that matches `gitProtocol` — VERIFY it, don't guess.** `gh auth status --hostname <host>`
  prints a `Git operations protocol:` line; set `gitProtocol` to exactly that (`ssh` or `https`). The
  template ships `"ssh"`, but gh's interactive login defaults to **HTTPS** — reconcile the two or the
  first worker clone fails with `Permission denied (publickey)`.
  - **ssh** → an SSH key on GitHub; verify `ssh -T git@<host>` returns the greeting.
  - **https** → `gh auth setup-git --hostname <host>` (installs gh as the credential helper); verify
    `git config --get-all credential.https://<host>.helper` ends in `gh auth git-credential`.
- **Token** — `gh auth login` provisions one. Bringing your own PAT: **fine-grained** with
  **Pull requests: read & write** (reply / react / resolve threads, edit title) + **Contents: read &
  write** (worker commits/pushes), or a classic PAT with `repo`.
- **(optional) Local clones** of the watched repos under your `cloneRoot` — else the daemon clones
  them fresh over the transport above. NOTE: **transport is not exercised by the scan** (the scan uses
  `gh`); the first worker that must clone a repo with *no* local checkout is where ssh/https auth is
  actually validated — so watch the daemon log on the first worker run, or pre-clone under `cloneRoot`.

## Write config.local.json (Claude helps)
Every field is documented in [config.ts](config.ts); validate against
[config.local.schema.json](config.local.schema.json) (its `$schema` ref gives editors live validation).

**If `config.local.json` already exists** (the usual case for re-setup / "scan failing" / workers
no-op), READ it and edit fields **in place** — it is the persistent record. Do NOT overwrite it. Only
scaffold from scratch on a truly empty first run, and never clobber an existing file:

```bash
[ -f config.local.json ] && echo 'config.local.json exists — edit it in place, do not overwrite' || cat > config.local.json <<'EOF'
{
  "$schema": "./config.local.schema.json",
  "profile": "dev",
  "cloneRoot": "/Users/you/src",
  "gitProtocol": "ssh",
  "profiles": {
    "dev": { "host": "github.com", "owner": "<owner>", "login": "<login>",
             "onlyPRs": ["<sandbox-repo>#<n>"] }
  }
}
EOF
```

**Gotchas — each has bitten a real setup:**
- **Strict JSON, no comments / trailing commas.** A parse error is NOT fatal: `config.ts` logs
  `[config] config.local.json failed to parse` and falls back to built-in defaults — silently dropping
  your whole local config (host, cloneRoot, gitProtocol, and the `onlyPRs` circuit-breaker). Because
  empty `onlyPRs` = ALL your PRs, a dropped config doesn't blank the dashboard — it quietly scans
  *everything*. Validate first: `node -e "JSON.parse(require('fs').readFileSync('config.local.json','utf8'))"`.
- **`cloneRoot` must be ABSOLUTE** — no `~`, no relative path (it's used verbatim; there is no tilde
  expansion). A literal `~/src` matches nothing, so the daemon silently skips your local clones and
  re-clones every repo fresh under `worktrees/`. Example: `/Users/you/src`.
- **Profile selection.** Active profile = `PRC_PROFILE` env, else the top-level `profile` key, else
  `prod` (an unknown name also falls back to `prod`). A bare `node --import tsx server.ts` uses the top-level
  `profile` key — the example pins `dev`. The built-in `prod` ships with EMPTY `onlyPRs`, and discovery
  uses your authed `gh` user (`--author @me`), NOT the config — so removing/mistyping the `profile` key
  silently falls back to `prod` and watches ALL your PRs (breaker OFF), not an empty board. Set it to
  the profile you want, or pass `PRC_PROFILE=<name> node --import tsx server.ts`.
- **`onlyPRs` is the circuit-breaker** — empty = ALL your open PRs. Keep it tight (see Run).

## Run — start with a throwaway PR
Validate each PR is open (`GH_HOST=<host> gh pr view <n> --repo <owner>/<repo>`), then:

1. **Scope first.** For the **very first run on a new machine**, set `onlyPRs` to a SINGLE
   throwaway/sandbox PR (the README's "hardening sandbox") — do this *before arming*, not before
   launching (see step 3).
2. **Launch** — build + start the daemon. This is inert: polling is OFF by default and never
   auto-starts, so nothing is scanned or dispatched yet.
   ```bash
   ( cd pr-controller-react && yarn install && yarn build ) && node --import tsx server.ts   # http://localhost:4317
   ```
3. **Arm** — open http://localhost:4317 and flip the dashboard polling toggle on. This is the
   moment it runs for real: the first poll acts (push / rebase / force-push / reply), and a
   force-push has no undo. Watch one full armed cycle succeed on the sandbox PR before widening
   `onlyPRs` to your real PRs.

## Confirm it worked
After `node --import tsx server.ts`, open http://localhost:4317:
- **Success** — the header shows your open count and (for a scoped/non-empty config) your PRs appear;
  the daemon log prints `N PRs, M need you (scanned as @<account>)`.
- **Scan failing** — a red `⚠ scan failing` badge in the header (hover for the error). CLI check:
  `curl -s localhost:4317/state.json | jq '{updatedAt, account, scope, lastPollError, prs: (.prs|length)}'`
  — `lastPollError` must be `null`; a non-null `.message` is the exact thing to fix.
- **Empty board, no error** — `lastPollError: null` with 0 PRs usually means your scope matched nothing:
  confirm the resolved `account` is who you expect (`gh auth status`) and that `onlyPRs` / `owner` are right.

---
_Improve this skill with `/auto-improve configure-pr-controller` (see [_changelog.json](_changelog.json))._
