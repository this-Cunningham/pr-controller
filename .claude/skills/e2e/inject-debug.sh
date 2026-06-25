#!/usr/bin/env bash
# Inject a simulated reviewer comment on a sandbox PR so the daemon dispatches a worker.
#
# A @claude-debug comment from YOUR OWN account on an UNRESOLVED review thread is re-attributed
# to a synthetic reviewer (scanner.mjs -> applyDebugReviewer), making the thread dispatchable on
# the next poll — exercising the full reviewer-last-word flow without a 2nd account. It must be a
# REVIEW-THREAD comment (gh pr comment / top-level issue comments are NOT re-attributed), and the
# thread must be UNRESOLVED (the scanner filters resolved threads before re-attribution).
#
# Write the feedback like a REAL reviewer would — the @claude-debug token (appended at the end) is
# the only plumbing; everything before it is what the dispatched worker reads as the feedback.
#
# Usage: inject-debug.sh <pr-number> "<feedback text>" [root-comment-databaseId]
#   With no id, targets the root comment of the PR's first UNRESOLVED review thread. List threads:
#     gh api graphql -f query='query{repository(owner:"this-Cunningham",name:"pr-controller"){pullRequest(number:PR){reviewThreads(first:50){nodes{isResolved path line comments(first:1){nodes{databaseId}}}}}}'
set -euo pipefail

REPO="${REPO:-this-Cunningham/pr-controller}"
OWNER="${REPO%%/*}"; NAME="${REPO##*/}"
PR="${1:?usage: inject-debug.sh <pr-number> \"<feedback>\" [root-comment-id]}"
FEEDBACK="${2:?usage: inject-debug.sh <pr-number> \"<feedback>\" [root-comment-id]}"
BODY="${FEEDBACK} @claude-debug"   # token at the end keeps the human-readable feedback realistic

CID="${3:-}"
if [ -z "$CID" ]; then
  # Root databaseId of the first UNRESOLVED thread (resolved threads are dropped by the scanner,
  # so replying to one would be a silent no-op). Fail loudly on a real API error instead of
  # swallowing the error JSON into CID.
  CID=$(gh api graphql \
    -f query='query($o:String!,$n:String!,$num:Int!){repository(owner:$o,name:$n){pullRequest(number:$num){reviewThreads(first:100){nodes{isResolved comments(first:1){nodes{databaseId}}}}}}}' \
    -f o="$OWNER" -f n="$NAME" -F num="$PR" \
    --jq '[.data.repository.pullRequest.reviewThreads.nodes[]|select(.isResolved==false)][0].comments.nodes[0].databaseId // empty') \
    || { echo "[inject] gh api failed for PR #$PR (bad number / auth / rate limit)." >&2; exit 1; }
fi

if [ -z "$CID" ]; then
  echo "[inject] PR #$PR has no UNRESOLVED review thread to reply to." >&2
  echo "         Seed a fresh review comment on a diff line first, or pick a PR that currently has" >&2
  echo "         an open thread (run: PRC_PROFILE=e2e node scripts/e2e-scan.mjs to see which do)." >&2
  exit 1
fi

URL=$(gh api "repos/$REPO/pulls/$PR/comments/$CID/replies" -f body="$BODY" --jq '.html_url')
echo "[inject] PR #$PR <- reviewer reply on comment $CID"
echo "         $URL"
echo "         (next poll re-attributes it to the synthetic reviewer -> dispatch; arm/repoll the daemon to pick it up)"
