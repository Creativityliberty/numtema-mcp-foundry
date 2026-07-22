#!/usr/bin/env sh
set -eu
TARGET=${1:-}
if [ -n "$TARGET" ]; then
  case "$TARGET" in
    */*) OWNER=${TARGET%%/*}; REPO=${TARGET#*/} ;;
    *) echo "Usage: $0 [owner/repository]" >&2; exit 2 ;;
  esac
else
  OWNER=${GITHUB_OWNER:-Creativityliberty}
  REPO=${GITHUB_REPO:-numtema-mcp-foundry}
fi
REMOTE=${GITHUB_REMOTE_URL:-https://github.com/$OWNER/$REPO.git}
BRANCH=${GITHUB_BRANCH:-main}
./scripts/audit-secrets.sh
npm run typecheck
npm test
if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$REMOTE"
else
  git remote set-url origin "$REMOTE"
fi
git branch -M "$BRANCH"
git push -u origin "$BRANCH"
echo "PUBLISHED $REMOTE"
