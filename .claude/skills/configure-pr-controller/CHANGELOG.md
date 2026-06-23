# Changelog — configure-pr-controller

## 3.2.0
- Renamed `setup-pr-controller` → `configure-pr-controller`.
- **Never clobber an existing config:** the write is now guarded (`[ -f ] && edit-in-place || scaffold`)
  and the skill tells Claude to READ & edit an existing `config.local.json` in place. The bare
  `cat > config.local.json` truncating heredoc previously wiped a populated config on the skill's own
  re-setup / "scan failing" / workers-no-op triggers.
- **Added a "Confirm it worked" step** — dashboard success/`⚠ scan failing` signals + a `curl/jq`
  check of `/state.json`, and the empty-board-means-scope-mismatch case (which `lastPollError` won't catch).
- **Added first-run safety** — explicit "no dry-run, the first poll acts for real" warning; recommend a
  single throwaway/sandbox PR first to exercise the real push paths safely.
- **Transport: verify, don't guess** — set `gitProtocol` from `gh auth status` ("Git operations
  protocol"); per-transport verification (`ssh -T`, credential-helper check); note that transport is
  only validated at worker-clone time (the scan uses `gh`).
- **Corrected gotchas** — strict JSON (a parse error silently drops the config → disables the
  circuit-breaker, not an empty board), absolute `cloneRoot` (silent loss of clone reuse), profile
  precedence (dropping the key falls back to `prod` = scans ALL). Point at `config.local.schema.json`
  and add `$schema` to the example for live validation.
- Added a `version`, this CHANGELOG, and the `/auto-improve` footer.

## 3.1.0
- Neutral built-in profiles; config ships without machine-specific values.
