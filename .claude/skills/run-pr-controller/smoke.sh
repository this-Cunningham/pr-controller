#!/usr/bin/env bash
# One-shot smoke test for pr-controller: build the dashboard, launch the daemon
# pointed at WHITELISTED dummy PRs on personal github.com, confirm it scans real
# data and serves a populated dashboard, screenshot it, then stop.
#
# Why personal-github whitelist (not the committed cargurus defaults, not a fake
# fixture): config.onlyPRs is the circuit-breaker — scoping to a few disposable
# "[e2e] … safe to close" PRs lets the daemon exercise the REAL scan/derive/render
# pipeline against REAL GitHub data without touching production. The default scope
# (pr-controller#1) is display-only (its threads are awaitingReviewer), so a plain
# run dispatches NO worker. Widen SCOPE to also hit #2/#3 to exercise the real
# feedback/rebase worker paths (the README's "hardening sandbox") — that DOES spawn
# `claude -p` workers against those disposable PRs.
#
# Prereqs: `gh` authed on github.com as this-Cunningham (the `dev` profile's owner).
#
# Usage:   .claude/skills/run-pr-controller/smoke.sh
# Env:     SCOPE (default pr-controller#1)   PORT (default 4317)
#          SHOT (default /tmp/prc-dashboard.png)   KEEP=1
set -euo pipefail

# Repo root = three levels up from this script (.claude/skills/run-pr-controller/).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

SCOPE="${SCOPE:-pr-controller#1}"
PORT="${PORT:-4317}"
SHOT="${SHOT:-/tmp/prc-dashboard.png}"

# 1. Build the dashboard if dist/ is missing (server returns 503 until it exists).
if [ ! -f pr-controller-react/dist/index.html ]; then
  echo "[smoke] building dashboard..."
  ( cd pr-controller-react && yarn install --silent && yarn build )
fi

# 2. Launch the daemon in the `dev` profile (config.mjs) — that sets host/owner/
#    login to the personal-github sandbox; PRC_ONLY_PRS narrows the profile's scope
#    to the no-dispatch demo PR. PRC_POLL_MINUTES=1440 avoids the 32-bit setInterval
#    overflow that huge values trigger (see SKILL.md Gotchas).
pkill -f "node server.mjs" 2>/dev/null || true
sleep 1
PRC_PROFILE=dev PRC_ONLY_PRS="$SCOPE" PRC_POLL_MINUTES=1440 PRC_PORT="$PORT" \
  node server.mjs > /tmp/prc-server.log 2>&1 &
SERVER_PID=$!
echo "[smoke] server pid $SERVER_PID, profile=dev scope=$SCOPE (sandbox on github.com)"

# 3. Wait for the startup poll to scan GitHub and populate state (a few seconds).
#    Keep the curl and the count separate so a not-yet-up server (failed curl)
#    can't smear the PR count with stray output.
PRS=0
for _ in $(seq 1 40); do
  resp=$(curl -fsS "http://localhost:$PORT/state.json" 2>/dev/null || true)
  # grep exits 1 on zero matches; with set -e + pipefail that would abort the
  # script while the server is still starting, so swallow it (|| true).
  PRS=$(printf '%s' "$resp" | grep -o '"number"' | wc -l | tr -d ' \n' || true)
  [ "${PRS:-0}" -ge 1 ] && break
  sleep 1
done

# 4. Screenshot the real dashboard. No init-script, no fixture — this is live
#    /state.json. Click the first lane tab with a non-zero count so the shot shows
#    real cards, not an empty "Needs you" landing. Retry: the React app fetches
#    /state.json and renders the counts a beat after navigate, so the button we
#    want may not exist on the first try.
chrome-devtools navigate_page --url "http://localhost:$PORT" >/dev/null
for _ in 1 2 3 4 5 6; do
  out=$(chrome-devtools evaluate_script \
    "() => { const b=[...document.querySelectorAll('button')].find(x => /(Needs you|In progress|Waiting on reviewer)\s*[1-9]/.test(x.textContent)); if (b) { b.click(); return 'clicked'; } return 'wait'; }" \
    --output-format=json 2>/dev/null || true)
  printf '%s' "$out" | grep -q clicked && break
  sleep 0.6
done
chrome-devtools take_screenshot --filePath "$SHOT" >/dev/null

echo "[smoke] screenshot -> $SHOT   (daemon scanned ${PRS:-0} PR(s) of real github.com data)"

# 5. Report worker dispatch. With the default scope (#1) there is none; widening to
#    #2/#3 dispatches real workers against the sandbox PRs (expected — not prod).
if pgrep -f "claude -p" >/dev/null 2>&1; then
  echo "[smoke] a 'claude -p' worker is running against the sandbox (expected for SCOPE #2/#3)."
fi

# 6. Stop, unless KEEP=1 (then leave it up for interactive driving).
if [ "${KEEP:-0}" = "1" ]; then
  echo "[smoke] KEEP=1 -> server left on http://localhost:$PORT (stop: pkill -f 'node server.mjs')"
else
  kill "$SERVER_PID" 2>/dev/null || true
  echo "[smoke] server stopped."
fi
[ "${PRS:-0}" -ge 1 ] && echo "[smoke] PASS" || { echo "[smoke] FAIL — no PRs scanned (gh auth on github.com? PRs still open?)"; exit 1; }
