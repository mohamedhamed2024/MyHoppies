#!/usr/bin/env bash
# Publish dwl-pilot git fixtures and open PRs on MyHoppies.
# Requires: git auth to github.com, and gh CLI for issues/PRs (or create issues in GitHub UI first).
#
# Usage:
#   ./scripts/dwl-pilot-push-and-open-prs.sh
#   IN_PROGRESS_ISSUE=42 ./scripts/dwl-pilot-push-and-open-prs.sh

set -euo pipefail
REPO_SLUG="mohamedhamed2024/MyHoppies"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --verify main >/dev/null 2>&1; then
  echo "Run from MyHoppies repo with main branch." >&2
  exit 1
fi

echo "Pushing main and dwl-pilot branches..."
git push origin main
git push -u origin dwl-pilot/linked
git push -u origin dwl-pilot/fail-ci

if ! command -v gh >/dev/null 2>&1; then
  echo "Branches pushed. Install gh (brew install gh) or open PRs manually on GitHub."
  echo "Linked PR body should include: Fixes #<in-progress-issue>"
  exit 0
fi

gh auth status >/dev/null 2>&2 || { echo "Run: gh auth login" >&2; exit 1; }

IN_PROGRESS="${IN_PROGRESS_ISSUE:-}"
if [[ -z "$IN_PROGRESS" ]]; then
  IN_PROGRESS="$(gh issue list --repo "$REPO_SLUG" --label dwl-pilot --state open --json number,title \
    --jq '.[] | select(.title | test("In progress")) | .number' | head -1)"
fi

BODY_SUFFIX=$'\n\n---\n`dwl-pilot` fixture for Daily Work Loop Copilot E2E.'

if [[ -z "$IN_PROGRESS" ]]; then
  echo "Creating pilot issues..."
  IN_PROGRESS="$(gh issue create --repo "$REPO_SLUG" --title "[dwl-pilot] In progress — queue ranking" \
    --body "Assigned in-progress work for /my-queue and /next-task.${BODY_SUFFIX}" \
    --label dwl-pilot --assignee @me | sed -n 's|.*/issues/\\([0-9]*\\).*|\\1|p')"
  gh issue create --repo "$REPO_SLUG" --title "[dwl-pilot] Blocked — waiting on review" \
    --body "Blocked item for --filter=blocked and status report.${BODY_SUFFIX}" \
    --label dwl-pilot --assignee @me >/dev/null
  DONE="$(gh issue create --repo "$REPO_SLUG" --title "[dwl-pilot] Done — status report completed" \
    --body "Close after create for status-report window.${BODY_SUFFIX}" \
    --label dwl-pilot --assignee @me | sed -n 's|.*/issues/\\([0-9]*\\).*|\\1|p')"
  gh issue close "$DONE" --repo "$REPO_SLUG" --comment "Completed in pilot seed." >/dev/null
  echo "In-progress issue: #$IN_PROGRESS (closed done: #$DONE)"
fi

gh pr create --repo "$REPO_SLUG" --head dwl-pilot/linked --base main \
  --title "[dwl-pilot] Linked PR waiting review" \
  --body "Fixes #${IN_PROGRESS}${BODY_SUFFIX}" || true

gh pr create --repo "$REPO_SLUG" --head dwl-pilot/fail-ci --base main \
  --title "[dwl-pilot] PR with failing CI" \
  --body "Triggers dwl-pilot-fail-ci workflow.${BODY_SUFFIX}" || true

echo "Done. Update reports/dwl-pilot-github-fixtures.md in the root workspace with issue/PR numbers."
