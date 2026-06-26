#!/usr/bin/env bash
# One-shot smoke for pr-controller: build the dashboard, launch the daemon scoped to a
# whitelist of disposable PRs, ARM POLLING, confirm it scans real GitHub data + serves a
# populated dashboard, screenshot it, then stop.
#
# Why this is safe: config.onlyPRs is the ONLY circuit-breaker (there is no dry-run). Scoping
# to a few disposable PRs exercises the REAL scan→derive→place→render pipeline against REAL
# GitHub without touching anything else. The dev profile (PRC_PROFILE=dev) points at the
# this-Cunningham/pr-controller sandbox (#1-3, all titled "safe to close").
#
# Prereqs: a config.local.json with a `dev` profile (run /configure-pr-controller), `gh` authed
# on github.com as the whitelist owner, and the `chrome-devtools` CLI on PATH.
#
# Usage:  .claude/skills/run-pr-controller/smoke.sh
# Env:    SCOPE (default pr-controller#1)   PORT (default 4317)
#         SHOT (default /tmp/prc-dashboard.png)   KEEP=1 (leave server up)
set -euo pipefail

# Repo root = three levels up from this script (.claude/skills/run-pr-controller/).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

SCOPE="${SCOPE:-pr-controller#1}"
PORT="${PORT:-4317}"
SHOT="${SHOT:-/tmp/prc-dashboard.png}"
LOG=/tmp/prc-server.log

# 1. Build the dashboard if dist/ is missing (server returns 503 "Dashboard not built" until it exists).
if [ ! -f pr-controller-react/dist/index.html ]; then
  echo "[smoke] building dashboard..."
  ( cd pr-controller-react && yarn install --silent && yarn build )
fi

# 2. Launch the daemon in the dev SANDBOX profile, scoped to SCOPE. PRC_PROFILE=dev is pinned
#    explicitly so the sandbox is used regardless of config.local.json's top-level `profile`.
#    PRC_POLL_MINUTES=1440 dodges the 32-bit setInterval overflow huge values trigger (see SKILL.md).
pkill -f "node server.mjs" 2>/dev/null || true
sleep 1
PRC_PROFILE=dev PRC_ONLY_PRS="$SCOPE" PRC_POLL_MINUTES=1440 PRC_PORT="$PORT" \
  node server.mjs > "$LOG" 2>&1 &
SERVER_PID=$!
echo "[smoke] server pid $SERVER_PID, profile=dev scope=$SCOPE (sandbox on github.com)"

# 3. Wait for the HTTP server to bind (it serves /state.json before any scan).
for _ in $(seq 1 30); do
  curl -fsS "http://localhost:$PORT/state.json" >/dev/null 2>&1 && break
  sleep 0.5
done

# 4. ARM POLLING. The daemon starts with polling OFF ("turn it on from the dashboard") — it
#    will NOT scan or dispatch until armed. This is the step the daemon needs to do any work.
echo "[smoke] arming polling..."
curl -fsS -X POST "http://localhost:$PORT/polling" -H 'content-type: application/json' -d '{"on":true}' >/dev/null

# 5. Wait for the first poll to scan GitHub and populate state (a few seconds).
PRS=0
for _ in $(seq 1 40); do
  resp=$(curl -fsS "http://localhost:$PORT/state.json" 2>/dev/null || true)
  # grep exits 1 on zero matches; with set -e + pipefail that aborts the script while the
  # server is still scanning, so swallow it (|| true).
  PRS=$(printf '%s' "$resp" | grep -o '"number"' | wc -l | tr -d ' \n' || true)
  [ "${PRS:-0}" -ge 1 ] && break
  sleep 1
done

# 6. Screenshot the real dashboard — live /state.json, no fixture. Click the first lane tab with
#    a non-zero count so the shot shows real cards, not the empty "Needs you" landing. Retry:
#    the React app fetches /state.json and renders counts a beat after navigate.
chrome-devtools navigate_page --url "http://localhost:$PORT" >/dev/null
for _ in 1 2 3 4 5 6; do
  out=$(chrome-devtools evaluate_script \
    "() => { const b=[...document.querySelectorAll('button')].find(x => /(Needs you|In progress|Waiting on reviewer)\s*[1-9]/.test(x.textContent)); if (b) { b.click(); return 'clicked'; } return 'wait'; }" \
    2>/dev/null || true)
  printf '%s' "$out" | grep -q clicked && break
  sleep 0.6
done
chrome-devtools take_screenshot --filePath "$SHOT" >/dev/null

echo "[smoke] screenshot -> $SHOT   (daemon scanned ${PRS:-0} PR(s) of real github.com data)"

# 7. Report worker dispatch. The default scope (#1) is display-only (its threads are
#    awaitingReviewer → no dispatch); widening to #2/#3 dispatches real claude -p workers
#    against the sandbox on the first armed poll (expected — sandbox, not prod).
if pgrep -f "claude -p" >/dev/null 2>&1; then
  echo "[smoke] a 'claude -p' worker is running against the sandbox (expected for SCOPE #2/#3)."
fi

# 8. Stop, unless KEEP=1 (then leave it up for interactive driving).
if [ "${KEEP:-0}" = "1" ]; then
  echo "[smoke] KEEP=1 -> server left on http://localhost:$PORT (stop: pkill -f 'node server.mjs')"
else
  kill "$SERVER_PID" 2>/dev/null || true
  echo "[smoke] server stopped."
fi
[ "${PRS:-0}" -ge 1 ] && echo "[smoke] PASS" || { echo "[smoke] FAIL — no PRs scanned (gh auth on github.com? PRs still open? polling armed?)"; exit 1; }
