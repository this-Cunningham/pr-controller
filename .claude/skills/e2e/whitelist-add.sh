#!/usr/bin/env bash
# Append a PR to the e2e whitelist (config.local.json -> profiles.e2e.onlyPRs) so the daemon
# will watch it. Idempotent + numerically sorted. New e2e PRs MUST be whitelisted or the
# circuit-breaker (config.onlyPRs) makes them invisible. Restart the daemon afterward —
# config is read once at module load.
#
# Usage: whitelist-add.sh <repo#num>          e.g. whitelist-add.sh pr-controller#31
set -euo pipefail

# Repo root = three levels up from this script (.claude/skills/e2e/).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ITEM="${1:?usage: whitelist-add.sh <repo#num>  e.g. pr-controller#31}"
CFG="$ROOT/config.local.json"
[ -f "$CFG" ] || { echo "[whitelist] $CFG not found — run /configure-pr-controller first." >&2; exit 1; }

node -e '
const fs = require("fs");
const [cfgPath, item] = process.argv.slice(1);
const c = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
c.profiles = c.profiles || {};
c.profiles.e2e = c.profiles.e2e || { host: "github.com", owner: "this-Cunningham", login: "this-Cunningham", onlyPRs: [] };
const set = new Set(c.profiles.e2e.onlyPRs || []);
const had = set.has(item);
set.add(item);
c.profiles.e2e.onlyPRs = [...set].sort((a, b) => (+(a.split("#")[1] || 0)) - (+(b.split("#")[1] || 0)));
fs.writeFileSync(cfgPath, JSON.stringify(c, null, 2) + "\n");
console.log(`[whitelist] ${had ? "already present" : "added"} ${item}`);
console.log("[whitelist] e2e.onlyPRs:", c.profiles.e2e.onlyPRs.join(", "));
' "$CFG" "$ITEM"
echo "[whitelist] restart the daemon to pick up the new scope (config is read once at load)."
