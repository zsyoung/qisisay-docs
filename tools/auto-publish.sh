#!/usr/bin/env bash
set -euo pipefail

# ====== 配置区 ======
REPO_DIR="$HOME/projects/write"
# 写作源稿（只放在 OneDrive，同步它就行）
SOURCE_DAILY_DIR="/Users/mlamp/Library/CloudStorage/OneDrive-个人/write/日更"

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

# ===== 流水线 =====
# 注意：请确保 scripts/sync-content.sh 已改为从 $SOURCE_DAILY_DIR 同步到 docs/日更
bash scripts/sync-content.sh

# ===== 草稿剔除（关键）：扫描 OneDrive 源稿，命中 #draft 则从 docs 构建输入移除（只删 docs，不动源稿）=====
if [ -d "$SOURCE_DAILY_DIR" ]; then
  find "$SOURCE_DAILY_DIR" -type f -name "*.md" -print0 \
  | while IFS= read -r -d '' src; do
      if head -n 5 "$src" 2>/dev/null | rg -qi '^#draft'; then
        rel="${src#"$SOURCE_DAILY_DIR/"}"
        dst="$REPO_DIR/docs/日更/$rel"
        rm -f "$dst"
        log "Draft removed from docs build input: $rel"
      fi
    done
else
  log "WARN: SOURCE_DAILY_DIR not found: $SOURCE_DAILY_DIR (skip draft removal)"
fi
# ===============================================================================================================

node scripts/sanitize-filenames.js
node scripts/sanitize-md-images.js
node scripts/generate-timeline.js
node scripts/generate-tags.js
node scripts/generate-latest.js

rm -rf docs/.vitepress/.temp docs/.vitepress/cache
npm run docs:build

# 暂存全部
git add -A

# ======（可选保险）草稿排除：避免把仓库里的 日更/... 草稿提交（如果你仓库里仍保留日更目录）======
# 如果你已做到“仓库不再存日更，只从 OneDrive 同步到 docs/日更”，这一段不会产生影响，也可以保留当保险。
DRAFT_SRC_FILES="$(
  if [ -d "$SOURCE_DAILY_DIR" ]; then
    find "$SOURCE_DAILY_DIR" -type f -name "*.md" -print0 \
    | while IFS= read -r -d '' f; do
        head -n 5 "$f" 2>/dev/null | rg -qi '^#draft' && echo "$f" || true
      done
  fi
)"

if [ -n "${DRAFT_SRC_FILES:-}" ]; then
  log "Draft source files detected (will NOT be committed if present in repo):"
  echo "$DRAFT_SRC_FILES" | tee -a "$LOG_FILE"

  while IFS= read -r f; do
    [ -z "$f" ] && continue
    # 将 OneDrive 源稿路径映射回仓库相对路径：日更/...
    rel_in_repo="日更/${f#"$SOURCE_DAILY_DIR/"}"
    git reset -q -- "$rel_in_repo" || true
  done <<< "$DRAFT_SRC_FILES"
fi
# =================================================================

# 如果此时没有可提交内容，就退出（避免空提交）
if [ -z "$(git diff --cached --name-only)" ]; then
  log "Nothing to commit after excluding drafts. Done."
  exit 0
fi

MSG="auto: publish $(date '+%Y-%m-%d %H:%M:%S')"
git commit -m "$MSG"
git push origin "$BRANCH"

log "Pushed to $BRANCH. GitHub Actions will deploy."
