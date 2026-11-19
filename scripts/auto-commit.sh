#!/usr/bin/env bash
# Auto-sync FinSight to GitHub.
# Run automatically after each development session: stages all changes
# (respecting .gitignore, so .env / the SQLite DB / build output are never committed),
# commits them, and pushes to origin/main. Safe to run manually too: `bash scripts/auto-commit.sh`.

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO" || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

committed=0
git add -A
if ! git diff --cached --quiet; then
  committed=$(git diff --cached --name-only | wc -l | tr -d ' ')
  summary=$(git diff --cached --name-only | head -4 | xargs -I{} basename "{}" | paste -sd ',' - | sed 's/,/, /g')
  [ "$committed" -gt 4 ] && summary="$summary, +$((committed - 4)) more"
  git commit -q -m "Update ${committed} file(s): ${summary}" || exit 0
fi

# Push new commits, plus any left over from an earlier failed push.
ahead=$(git rev-list --count "origin/main..HEAD" 2>/dev/null || echo 1)
[ "$ahead" -eq 0 ] && exit 0

if GIT_TERMINAL_PROMPT=0 git push -q origin HEAD:main 2>/dev/null; then
  detail=""
  [ "$committed" -gt 0 ] && detail=" (${committed} file(s) changed)"
  echo "{\"systemMessage\": \"FinSight: pushed ${ahead} commit(s) to GitHub${detail}\"}"
else
  echo "{\"systemMessage\": \"FinSight: changes committed locally, but the push to GitHub failed - it will retry after the next turn\"}"
fi
exit 0
