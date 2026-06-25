#!/usr/bin/env bash
# Clear comments/threads on the e2e sandbox PRs so a run starts from a clean slate.
# Reads the fleet from the e2e whitelist (config.local.json -> profiles.e2e.onlyPRs).
#
# Usage:
#   reset-prs.sh                 SAFE (default): resolve every OPEN review thread on every
#                                whitelisted PR. The scanner filters resolved threads, so the
#                                daemon sees zero — reversible (unresolveReviewThread).
#   reset-prs.sh --hard          WIPE: delete every review (line) comment AND every issue
#                                (top-level) comment. Irreversible. Use for a pristine slate.
#   reset-prs.sh [--hard] 12 13  Limit to specific PR numbers instead of the whole whitelist.
#
# Safe to run liberally — these are disposable sandbox PRs (see the use-e2e-sandbox-freely note).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
REPO="${REPO:-this-Cunningham/pr-controller}"
OWNER="${REPO%%/*}"; NAME="${REPO##*/}"

HARD=0
if [ "${1:-}" = "--hard" ]; then HARD=1; shift; fi

# PR list: explicit args, else the e2e whitelist numbers. (No mapfile — macOS ships bash 3.2.)
if [ "$#" -gt 0 ]; then
  PRS=( "$@" )
else
  PRS=( $(node -e '
    const fs = require("fs");
    const c = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    for (const id of (c.profiles && c.profiles.e2e && c.profiles.e2e.onlyPRs) || [])
      process.stdout.write(id.split("#")[1] + "\n");
  ' "$ROOT/config.local.json") )
fi
[ "${#PRS[@]}" -gt 0 ] || { echo "[reset] no PRs (empty whitelist?)." >&2; exit 1; }

echo "[reset] repo=$REPO mode=$([ "$HARD" = 1 ] && echo HARD-delete || echo resolve) prs=${PRS[*]}"

for PR in "${PRS[@]}"; do
  STATE=$(gh pr view "$PR" --repo "$REPO" --json state --jq .state 2>/dev/null || echo MISSING)
  [ "$STATE" = "OPEN" ] || { echo "[reset] #$PR $STATE — skip"; continue; }

  if [ "$HARD" = 1 ]; then
    for id in $(gh api "repos/$REPO/pulls/$PR/comments" --jq '.[].id' 2>/dev/null || true); do
      gh api -X DELETE "repos/$REPO/pulls/comments/$id" >/dev/null 2>&1 && echo "  #$PR del review-comment $id" || true
    done
    for id in $(gh api "repos/$REPO/issues/$PR/comments" --jq '.[].id' 2>/dev/null || true); do
      gh api -X DELETE "repos/$REPO/issues/comments/$id" >/dev/null 2>&1 && echo "  #$PR del issue-comment $id" || true
    done
  else
    for tid in $(gh api graphql \
        -f query='query($o:String!,$n:String!,$num:Int!){repository(owner:$o,name:$n){pullRequest(number:$num){reviewThreads(first:100){nodes{id isResolved}}}}}' \
        -f o="$OWNER" -f n="$NAME" -F num="$PR" \
        --jq '.data.repository.pullRequest.reviewThreads.nodes[]|select(.isResolved==false)|.id' 2>/dev/null || true); do
      gh api graphql -f query='mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' \
        -f id="$tid" >/dev/null 2>&1 && echo "  #$PR resolved $tid" || true
    done
  fi
done
echo "[reset] done — restart the daemon (or wait for the next poll) so it re-scans the cleaned PRs."
