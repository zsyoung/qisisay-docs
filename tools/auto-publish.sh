#!/usr/bin/env bash
set -euo pipefail

# ====== 配置区：按需改 ======
REPO_DIR="/Users/mlamp/Library/CloudStorage/OneDrive-个人/write"
BRANCH="main"
LOG_DIR="$HOME/Library/Logs"
LOG_FILE="$LOG_DIR/qisisay-autopublish.log"
LOCK_FILE="/tmp/qisisay-autopublish.lock"
# ===========================

mkdir -p "$LOG_DIR"

# 追加日志
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

# 确保是 git 仓库
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  log "Not a git repo: $REPO_DIR"
  exit 1
}

# 只在指定分支工作
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  log "Current branch is $CURRENT_BRANCH, expected $BRANCH. Skip."
  exit 0
fi

# 如果有未提交变更才做事（包括未跟踪文件）
if [ -z "$(git status --porcelain)" ]; then
  log "No changes. Done."
  exit 0
fi

log "Changes detected. Running pipeline..."

# 尽量补齐 PATH（LaunchAgent 环境变量很干净）
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# 你的流水线（注意：sync-content 是 bash）
bash scripts/sync-content.sh
node scripts/sanitize-filenames.js
node scripts/sanitize-md-images.js
node scripts/generate-timeline.js
node scripts/generate-tags.js
node scripts/generate-latest.js

rm -rf docs/.vitepress/.temp docs/.vitepress/cache
npm run docs:build

# 提交并推送
git add -A

# 如果 add 后又变干净（极少数情况），就不提交
if [ -z "$(git status --porcelain)" ]; then
  log "No staged changes after pipeline. Done."
  exit 0
fi

MSG="auto: publish $(date '+%Y-%m-%d %H:%M:%S')"
git commit -m "$MSG"
git push origin "$BRANCH"

log "Pushed to $BRANCH. GitHub Actions will deploy."
