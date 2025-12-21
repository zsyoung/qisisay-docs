#!/usr/bin/env bash
set -euo pipefail

# ====== 配置区 ======
REPO_DIR="/Users/mlamp/Library/CloudStorage/OneDrive-个人/write"
BRANCH="main"
LOG_DIR="$HOME/Library/Logs"
LOG_FILE="$LOG_DIR/qisisay-autopublish.log"
LOCK_FILE="/tmp/qisisay-autopublish.lock"
# ====================

mkdir -p "$LOG_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# 防并发
if [ -f "$LOCK_FILE" ]; then
  log "Lock exists, skip."
  exit 0
fi
touch "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

cd "$REPO_DIR"

# 补齐 PATH（LaunchAgent 环境变量很干净）
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# 只在指定分支工作
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  log "Current branch is $CURRENT_BRANCH, expected $BRANCH. Skip."
  exit 0
fi

# 若完全无改动，退出
if [ -z "$(git status --porcelain)" ]; then
  log "No changes. Done."
  exit 0
fi

log "Changes detected. Running pipeline..."

# 流水线
bash scripts/sync-content.sh
node scripts/sanitize-filenames.js
node scripts/sanitize-md-images.js
node scripts/generate-timeline.js
node scripts/generate-tags.js
node scripts/generate-latest.js

rm -rf docs/.vitepress/.temp docs/.vitepress/cache
npm run docs:build

# 暂存全部
git add -A

# ====== 关键：把草稿文件从提交中排除（但保留在本地） ======
# 规则：docs/日更 下，任一 md 文件前 5 行出现 "#draft" => 该文件不提交
DRAFT_FILES="$(rg -l -n --max-count 1 '^#draft' docs/日更 --glob '*.md' --context 0 --before-context 0 --after-context 0 --ignore-case -U \
  | while read -r f; do
      head -n 5 "$f" 2>/dev/null | rg -qi '^#draft' && echo "$f" || true
    done)"

if [ -n "${DRAFT_FILES:-}" ]; then
  log "Draft files detected (will NOT be committed):"
  echo "$DRAFT_FILES" | tee -a "$LOG_FILE"

  # 取消暂存这些草稿文件（让它们留在本地修改态，但不进 commit）
  while IFS= read -r f; do
    [ -n "$f" ] && git reset -q -- "$f" || true
  done <<< "$DRAFT_FILES"
fi
# ===========================================================

# 如果此时没有可提交内容，就退出（避免空提交）
if [ -z "$(git diff --cached --name-only)" ]; then
  log "Nothing to commit after excluding drafts. Done."
  exit 0
fi

MSG="auto: publish $(date '+%Y-%m-%d %H:%M:%S')"
git commit -m "$MSG"
git push origin "$BRANCH"

log "Pushed to $BRANCH. GitHub Actions will deploy."
